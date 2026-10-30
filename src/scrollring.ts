import { getWindow, maxWindowSize, type RowWindow } from "./math";

export interface RowContext {
  index: number;
}

export interface ScrollRingOptions<T> {
  /** Fixed height of every row, in px. */
  rowHeight: number;
  /** Id of the scrolling element. It needs a fixed height in CSS. */
  scrollContainer: string;
  /**
   * Fill `node` with `item`. Nodes are reused for different rows, so this
   * must overwrite everything a previous call may have set.
   */
  renderRow: (node: HTMLElement, item: T, ctx: RowContext) => void;
  /** Extra rows rendered above and below the viewport. Default 50. */
  buffer?: number;
}

export interface ScrollRing<T> {
  setData(data: readonly T[]): void;
  scrollToIndex(index: number): void;
  destroy(): void;
}

const DEFAULT_OVERSCAN = 50;
const EMPTY = -1;

export function createScrollRing<T = unknown>(
  options: ScrollRingOptions<T>,
): ScrollRing<T> {
  const container = getContainer(options.scrollContainer);
  const { rowHeight, renderRow } = options;
  const overscan = options.buffer ?? DEFAULT_OVERSCAN;

  if (rowHeight <= 0) {
    throw new Error(
      "Please provide a fixed rowHeight for the container where elements will be rendered.",
    );
  }
  if (container.clientHeight < rowHeight) {
    throw new Error("Scroll container has no height");
  }

  container.style.overflow = "auto";

  // As tall as the whole list, so the scrollbar has the right size.
  // The row nodes live inside it.
  const spacer = document.createElement("div");
  spacer.className = "scroll-ring-rows";
  spacer.style.position = "relative";
  container.appendChild(spacer);

  // The ring: row `i` is always drawn by nodes[i % poolSize]. The window is
  // never longer than poolSize, so its rows all map to different slots.
  const poolSize = maxWindowSize(container.clientHeight, rowHeight, overscan);
  const nodes = createNodes(spacer, poolSize, rowHeight);
  // rowOf[slot] = the row nodes[slot] is showing, or EMPTY.
  const rowOf = new Int32Array(poolSize).fill(EMPTY);

  let items: readonly T[] = [];
  // The window currently on screen; used to skip work when it hasn't moved.
  let painted: RowWindow = { start: 0, end: 0 };
  let alive = true;
  let warnedOverflow = false;

  function syncToScroll() {
    if (!alive) return;

    const next = getWindow({
      scrollTop: container.scrollTop,
      viewportHeight: container.clientHeight,
      rowHeight,
      count: items.length,
      overscan,
    });
    if (next.start === painted.start && next.end === painted.end) return;

    painted = next;
    paintRange(next.start, next.end);
  }

  function paintRange(start: number, end: number) {
    // Can happen if the container grew after the pool was sized.
    // Two rows would then share a slot, so drop the extra rows.
    if (end - start > poolSize) {
      if (!warnedOverflow) {
        warnedOverflow = true;
        console.error("ScrollRing: window is larger than the pool", {
          poolSize,
          start,
          end,
        });
      }
      end = start + poolSize;
    }

    // 1. Give every row in the window its slot. Slots that already show
    //    the right row are skipped, so a small scroll touches few nodes.
    for (let row = start; row < end; row++) {
      const slot = row % poolSize;
      if (rowOf[slot] === row) continue;

      const node = nodes[slot];
      try {
        renderRow(node, items[row], { index: row });
      } catch (e) {
        // A bug in user code shouldn't break the list.
        console.error("ScrollRing: renderRow threw", { index: row }, e);
      }
      node.style.transform = "translate3d(0," + row * rowHeight + "px,0)";
      node.style.display = "";
      rowOf[slot] = row;
    }

    // 2. Hide slots that were not reused: their row left the window.
    for (let slot = 0; slot < poolSize; slot++) {
      const row = rowOf[slot];
      if (row === EMPTY || (row >= start && row < end)) continue;
      nodes[slot].style.display = "none";
      rowOf[slot] = EMPTY;
    }
  }

  // Forget what every slot shows. Without this the skip check in
  // paintRange would keep old content on screen.
  function clearSlots() {
    rowOf.fill(EMPTY);
    for (const node of nodes) node.style.display = "none";
    painted = { start: 0, end: 0 };
  }

  function setData(newItems: readonly T[]): void {
    if (!alive) throw new Error("ScrollRing: setData() called after destroy()");
    if (!Array.isArray(newItems)) {
      throw new TypeError("ScrollRing: setData() expects an array");
    }

    items = newItems;
    spacer.style.height = `${items.length * rowHeight}px`;
    clearSlots();
    syncToScroll();
  }

  function scrollToIndex(index: number): void {
    if (!alive || items.length === 0) return;
    const row = Math.max(0, Math.min(Math.floor(index), items.length - 1));
    container.scrollTop = row * rowHeight;
  }

  function destroy(): void {
    if (!alive) return;
    alive = false;
    container.removeEventListener("scroll", syncToScroll);
    spacer.remove();
  }

  container.addEventListener("scroll", syncToScroll, { passive: true });

  return { setData, scrollToIndex, destroy };
}

function createNodes(
  parent: HTMLElement,
  count: number,
  rowHeight: number,
): HTMLElement[] {
  const fragment = document.createDocumentFragment();
  const nodes: HTMLElement[] = [];

  for (let i = 0; i < count; i++) {
    const node = document.createElement("div");
    node.className = "scroll-row";
    const st = node.style;
    st.position = "absolute";
    st.top = "0";
    st.left = "0";
    st.right = "0";
    st.height = `${rowHeight}px`;
    st.boxSizing = "border-box";
    // Row content can't change the size or paint of anything outside it.
    st.contain = "layout paint";
    st.display = "none";
    fragment.appendChild(node);
    nodes.push(node);
  }

  parent.appendChild(fragment);
  return nodes;
}

function getContainer(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`ScrollRing: element #${id} not found`);
  return el;
}
