# scrollring

A small, framework-agnostic virtual list for the browser, written in TypeScript.
It renders only the rows near the viewport and **reuses a fixed set of DOM
nodes** while you scroll, so a list of 100,000 rows uses about the same number
of DOM nodes as a list of 100.

> **Learning project.** I built this to understand how list virtualization and
> DOM node recycling work. It is small on purpose. For production apps, use a
> mature library such as [TanStack Virtual](https://tanstack.com/virtual) or
> [react-window](https://github.com/bvaughn/react-window).

## Features

- Fixed-size DOM node pool, sized from the viewport. Nodes are never created
  or removed while scrolling.
- Ring assignment: row `i` is always drawn by node `i % poolSize`, so finding
  a node is O(1) with no search and no bookkeeping map.
- Only nodes whose row changed are repainted.
- The pool grows when the container gets taller (`ResizeObserver`), so a
  resizable or full-height list keeps working.
- No dependencies, no framework. Works with plain DOM.
- TypeScript types included.

## Limitations

- All rows must have the **same fixed height**.
- **Vertical** lists only.
- Rows are tied to their **index**, not to a key. Inserting an item at the top
  repaints the visible rows instead of moving them. See
  [ARCHITECTURE.md](ARCHITECTURE.md#trade-offs).

## Quick start

```html
<div id="list" style="height: 400px"></div>
```

```ts
import { createScrollRing } from "scrollring";

const list = createScrollRing<{ name: string }>({
  container: "list", // the element or its id; it needs a fixed height
  itemHeight: 40,
  renderItem(node, item, { index }) {
    // Nodes are reused, so overwrite everything you set before.
    node.textContent = item.name;
    node.classList.toggle("odd", index % 2 === 1);
  },
});

list.setData(
  Array.from({ length: 100_000 }, (_, i) => ({ name: `Row ${i + 1}` })),
);
```

Not published to npm yet. To try it, clone the repo and run the demo
(see [Development](#development)).

## API

### `createScrollRing<T>(options): ScrollRing<T>`

| Option        | Type                                                     | Description                                                       |
| ------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `container`   | `HTMLElement \| string`                                  | The scrolling element, or its id. It must have a fixed height in CSS. |
| `itemHeight`  | `number`                                                 | Height of every item in px.                                       |
| `renderItem`  | `(node: HTMLElement, item: T, ctx: { index }) => void`   | Fills a node with an item. Must fully overwrite the node.         |
| `buffer`      | `number` (default `50`)                                  | Extra items rendered above and below the viewport.                |

Throws if the element is not found, `itemHeight <= 0`, or the container has no height.

### Instance methods

| Method               | Description                                                   |
| -------------------- | ------------------------------------------------------------- |
| `setData(items)`     | Replaces the list data and redraws.                           |
| `scrollToIndex(i)`   | Scrolls so row `i` is at the top. `i` is clamped to the list. |
| `destroy()`          | Removes the scroll listener, stops the `ResizeObserver` and removes the nodes. The instance can't be reused. |

If `renderItem` throws, the error is logged and the list keeps working.

## How it works

1. A spacer element is as tall as the whole list (`count × itemHeight`), so the
   browser draws a normal scrollbar.
2. On scroll, the window of rows to render is computed from `scrollTop`:
   the visible rows plus `buffer` rows on each side.
3. The pool has exactly as many nodes as the largest possible window:
   `ceil(viewportHeight / itemHeight) + 1 + 2 × buffer`.
4. Row `i` goes to node `i % poolSize` and is moved into place with
   `transform: translate3d(...)`. Nodes whose row left the window are hidden.
5. A `ResizeObserver` watches the container. If it gets taller, nodes are
   added to the pool and the window is repainted. The pool never shrinks.

Why two rows can never share a node is explained in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Performance

<!-- TODO: fill in from your own measurements. Do not copy numbers from elsewhere. -->

| Metric                     | Naive (all rows) | scrollring |
| -------------------------- | ---------------- | ---------- |
| DOM nodes, 100k rows       | TODO             | TODO       |
| Time to first render       | TODO             | TODO       |
| Frame time p95 / p99       | TODO             | TODO       |
| JS heap                    | TODO             | TODO       |

**Method:** TODO: browser + version, OS, hardware, row count, how the scroll
was scripted, median of N runs.

## Testing

Three layers:

- **Unit** (Vitest, Node): the window math, including a property test that
  steps `scrollTop` by 7px across 100k rows with non-round sizes and checks
  the window never exceeds the pool.
- **Component** (Vitest + jsdom): node count, ring slot assignment, `setData`
  redraws, `scrollToIndex` clamping, `destroy`, errors in `renderItem`, and
  pool growth on resize. jsdom has no layout, so `clientHeight` and
  `scrollTop` are faked, and `ResizeObserver` is a fake the test fires by hand.
- **Browser** (Playwright): the real demo page. Node count stays flat while
  scrolling 100k rows, the last row is reachable, and making the list taller
  adds nodes and fills the new space.

## Development

```bash
npm install
npm run dev        # demo at http://localhost:5173/demo/
npm test           # unit + component tests
npm run test:e2e   # Playwright (starts Vite itself)
npm run typecheck
npm run build      # ESM + CJS + .d.ts into dist/
```

## Credits

The idea of recycling DOM nodes instead of creating and destroying them comes
from [Complexities of an infinite scroller](https://developer.chrome.com/blog/infinite-scroller)
by Surma and Robert Flack (Chrome for Developers).

## License

[MIT](LICENSE)
