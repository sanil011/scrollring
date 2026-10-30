import { computeRange, maxWindowSize } from "./math";

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

const DEFAULT_BUFFER = 50;
const EMPTY = -1;

export function createScrollRing<T = unknown>(
  options: ScrollRingOptions<T>,
): ScrollRing<T> {
  const scrollContainer = _resolveElement(options.scrollContainer);
  const { rowHeight, renderRow } = options;

  if (rowHeight <= 0) {
    throw new Error(
      "Please provide a fixed rowHeight for the container where elements will be rendered.",
    );
  }

  if (scrollContainer.clientHeight < rowHeight) {
    throw new Error("Scroll container has no height");
  }

  const buffer = options.buffer ?? DEFAULT_BUFFER;

  scrollContainer.style.overflow = "auto";

  // Its height is the full list height, which gives the scrollbar its size.
  const rowContainer = document.createElement("div");
  rowContainer.className = "scroll-ring-rows";
  rowContainer.style.position = "relative";
  scrollContainer.appendChild(rowContainer);

  // The ring: row `i` is always drawn by nodes[i % poolSize]. The window is
  // never longer than poolSize, so its rows all map to different slots.
  const poolSize = maxWindowSize(
    scrollContainer.clientHeight,
    rowHeight,
    buffer,
  );
  const nodes = createNodes(rowContainer, poolSize, rowHeight);
  // rowOf[slot] = the row nodes[slot] is showing, or EMPTY.
  const rowOf = new Int32Array(poolSize).fill(EMPTY);

  let data: readonly T[] = [];
  let range = { start: 0, end: 0 };
  let destroyed = false;
  let warnedOverflow = false;

  function update() {
    if (destroyed) return;

    const next = computeRange({
      scrollTop: scrollContainer.scrollTop,
      vpHeight: scrollContainer.clientHeight,
      totalData: data.length,
      buffer,
      rowHeight,
    });

    if (next.start === range.start && next.end === range.end) return;
    range = next;
    paintRange(range.start, range.end);
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
        renderRow(node, data[row], { index: row });
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

  function setData(newData: readonly T[]): void {
    if (destroyed) throw new Error("ScrollRing: instance destroyed");
    if (!Array.isArray(newData)) {
      throw new TypeError("ScrollRing: data must be an array");
    }
    data = newData;
    rowContainer.style.height = `${data.length * rowHeight}px`;

    // Forget what every slot shows, or the skip check in paintRange would
    // keep old content on screen.
    rowOf.fill(EMPTY);
    for (const node of nodes) node.style.display = "none";
    range = { start: 0, end: 0 };

    update();
  }

  function scrollToIndex(index: number): void {
    if (destroyed || data.length === 0) return;
    const i = Math.max(0, Math.min(Math.floor(index), data.length - 1));
    scrollContainer.scrollTop = i * rowHeight;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    scrollContainer.removeEventListener("scroll", update);
    rowContainer.remove();
  }

  scrollContainer.addEventListener("scroll", update, { passive: true });

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

function _resolveElement(elementId: string): HTMLElement {
  const container = document.getElementById(elementId);
  if (!container) {
    throw new Error(
      `ScrollRing: element "${elementId}" not found or not a DOM element`,
    );
  }
  return container;
}
