# Architecture

How scrollring decides which rows to render and which DOM node draws each
one, why that is correct, and what it costs.

Code: [`src/math.ts`](src/math.ts) (pure math) and
[`src/scrollring.ts`](src/scrollring.ts) (DOM).

## Overview

```
scroll container (fixed height, overflow: auto)
└── spacer  (height = count × itemHeight → real scrollbar)
    ├── node 0   ┐
    ├── node 1   │ poolSize nodes, position: absolute,
    ├── ...      │ moved with translate3d(0, row × itemHeight, 0)
    └── node N-1 ┘
```

On every scroll event:

1. `getWindow()` turns `scrollTop` into a window of rows `[start, end)`.
2. If the window didn't change, stop. Most scroll events end here.
3. `paintRange(start, end)` puts each row in the window into its node and
   hides nodes whose row left the window.

On every resize of the container (`ResizeObserver`):

1. Recompute the pool size for the new height (section 2).
2. If the pool is too small, add nodes and reset the ring (section 4).
3. Run the same steps as a scroll event, because the visible rows changed.

## 1. The window

```
firstVisible     = floor(scrollTop / itemHeight)
afterLastVisible = ceil((scrollTop + viewportHeight) / itemHeight)   // exclusive
end   = min(count, afterLastVisible + overscan)
start = min(end, max(0, firstVisible - overscan))
```

- `floor` on the top edge: a row cut off at the top is still partly visible,
  so it must be included.
- `ceil` on the bottom edge: same for a row cut off at the bottom.
- `end` is exclusive everywhere, so loops are `row < end`.
- The result always satisfies `0 <= start <= end <= count`.

## 2. Pool size

A viewport of height `H` with rows of height `h` can show parts of
`ceil(H / h) + 1` rows: when it isn't aligned to a row boundary, one row is
cut off at the top and one at the bottom. With `overscan` on each side:

```
poolSize = ceil(H / h) + 1 + 2 × overscan
```

**Invariant: `end - start <= poolSize` for every scroll position.**
A unit test checks this by stepping `scrollTop` by 7px through 100,000 rows
with non-round sizes (for example a 398px viewport with 40px rows).

`H` is read once at creation and again on every resize, so the invariant
also holds after the container gets taller (see section 4).

## 3. Ring assignment

```
slot(row) = row % poolSize
rowOf[slot] = the row that node is showing, or -1
```

**Why two rows in the window never share a node:** the window is at most
`poolSize` *consecutive* rows. Any `poolSize` consecutive integers have
different remainders modulo `poolSize`. So every row in the window gets its
own slot.

This is also why the `+ 1` in the pool size matters. With one node too few,
the first and last rows of a full window have the same remainder and fight
over one node.

`paintRange` is two loops:

1. For each row in `[start, end)`: if `rowOf[slot] === row`, skip it.
   Otherwise call `renderItem`, set the transform, show the node, and update
   `rowOf`.
2. For each slot: if its row is outside `[start, end)`, hide it and set it
   to `-1`.

When you scroll by one row, the window moves by one, so loop 1 renders
**one** node; the rest are skipped. Each loop is O(poolSize), with no
allocations and no search.

## 4. Growing the pool on resize

The pool size depends on the viewport height `H`, so a taller container
needs more nodes. A `ResizeObserver` on the container calls `onResize()`:

```
needed = ceil(H / h) + 1 + 2 × overscan
if needed > poolSize:
    append (needed - poolSize) hidden nodes
    poolSize = needed
    rowOf = new Int32Array(poolSize), all -1
    forget the painted window
syncToScroll()
```

**Why every slot is reset:** the ring maps row `r` to `r % poolSize`. When
`poolSize` changes, almost every row maps to a different slot, so the old
`rowOf` entries describe a layout that no longer exists. Keeping them would
make the "skip if the slot already shows this row" check wrong. Resetting
costs one full repaint, and resizes are rare compared with scrolls.

**Why the pool never shrinks:** a shorter container just needs a smaller
window, which a bigger pool can always hold (the invariant is
`end - start <= poolSize`, not `==`). Extra nodes stay hidden and cost
almost nothing, and removing them would mean another full reset if the
container grows back.

**Without `ResizeObserver`** (jsdom, very old browsers) the pool keeps its
first size. If the window ever gets larger than the pool, `paintRange`
trims it to `poolSize` rows and logs one error, so two rows never share a
node.

`destroy()` disconnects the observer.

## Trade-offs

| | Ring (scrollring) | Keyed pool |
| --- | --- | --- |
| Node for a row | `row % poolSize`, O(1) | Search for a free node, plus a map |
| State to keep in sync | One `Int32Array` | Map, bindings, free list |
| Insert / reorder data | Visible rows repaint | Nodes move with their item |
| Node keeps state (focus, input, animation) with its item | No | Yes |

The ring is the right choice for a fixed-height list that is redrawn when
its data changes. A keyed pool is worth its extra state when nodes must
follow their item: keyed updates, enter/exit animations, or rows with input
focus. 

<!-- TODO: measure the cost of a full repaint after inserting at the top,
     then write here whether it matters. -->

## Edge cases

- **Container resized.** Handled by the pool growth in section 4.
- **`setData`.** Clears `rowOf` and the cached window. Otherwise the "skip if
  the slot already shows this row" check would leave old content on screen.
- **`renderItem` throws.** The error is logged; the node is still positioned
  and the list keeps working.
- **Negative `scrollTop`** (macOS overscroll bounce) is treated as 0.

## Testing notes

- jsdom has no layout: component tests fake `clientHeight` and `scrollTop`,
  and leave real layout checks to Playwright.
- jsdom has no `ResizeObserver`: component tests stub it with a fake whose
  callback the test fires by hand. A Playwright test resizes the real demo
  and checks that a row only reachable with the bigger pool is drawn.
