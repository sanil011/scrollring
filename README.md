# scrollring

[![CI](https://github.com/sanil011/scrollring/actions/workflows/ci.yml/badge.svg)](https://github.com/sanil011/scrollring/actions/workflows/ci.yml)

A small, framework-agnostic virtual list for the browser, written in TypeScript.
It renders only the rows near the viewport and **reuses a fixed set of DOM
nodes** while you scroll, so a list of 100,000 rows uses about the same number
of DOM nodes as a list of 100.

**[Live demo](https://sanil011.github.io/scrollring/)**: scroll 100,000 rows,
watch the node count stay flat, and see which pool slot draws each row.

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

Not published to npm yet. Try the [live demo](https://sanil011.github.io/scrollring/),
or clone the repo and run it locally (see [Development](#development)).

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

A spacer as tall as the whole list gives the browser a normal scrollbar. On
scroll, the visible rows plus `buffer` rows on each side are drawn by a fixed
pool of nodes, where row `i` always uses node `i % poolSize`. A
`ResizeObserver` grows the pool if the container gets taller.

Why two rows can never share a node, and the trade-offs of this design, are
in [ARCHITECTURE.md](ARCHITECTURE.md).

## Performance

100,000 rows, median of 20 runs (Chromium, Apple M1, CPU throttled 2×):

| Metric                     | Naive (all rows)      | scrollring            |
| -------------------------- | --------------------- | --------------------- |
| DOM elements               | 100,009               | 121                   |
| Time to first render       | 916 ms                | 18 ms (within one frame) |
| Frame time p50 / p95 / p99 | 32.4 / 50.1 / 50.9 ms | 16.7 / 18.5 / 18.7 ms |

Rows are text only, and the scroll is scripted. Full method, conditions and
caveats: [BENCHMARKS.md](BENCHMARKS.md).

## Development

```bash
npm install
npm run dev        # demo at http://localhost:5173/demo/
npm test           # unit + component tests (Vitest, jsdom)
npm run test:e2e   # browser tests (Playwright, starts Vite itself)
npm run typecheck
npm run build      # ESM + CJS + .d.ts into dist/
npm run build:demo # production build of the demo into site/
npm run bench      # benchmark, see BENCHMARKS.md
```

Testing strategy: [ARCHITECTURE.md](ARCHITECTURE.md#testing).

## Credits

The idea of recycling DOM nodes instead of creating and destroying them comes
from [Complexities of an infinite scroller](https://developer.chrome.com/blog/infinite-scroller)
by Surma and Robert Flack (Chrome for Developers).

## License

[MIT](LICENSE)
