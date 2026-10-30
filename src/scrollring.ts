import { Pool } from "./pool";
import { computeRange } from "./math";

export interface RowContext {
  index: number;
}

export interface ScrollRingOptions<T> {
  rowHeight: number;
  scrollContainer: string;
  renderRow: any;
  buffer?: number;
}

export interface ScrollRing<T> {
  setData(data: readonly T[]): void;
  scrollToIndex(index: number): void;
  destroy(): void;
}

const DEFAULT_BUFFER = 50;

export function createScrollRing<T = unknown>(
  options: ScrollRingOptions<T>,
): ScrollRing<T> {
  const scrollContainer = _resolveElement(options.scrollContainer);
  if (options.rowHeight <= 0) {
    throw new Error(
      "Please provide a fixed rowHeight for the container where elements will be rendered.",
    );
  }

  if (scrollContainer.clientHeight < options.rowHeight) {
    throw new Error("Scroll container has no height");
  }

  scrollContainer.style.overflow = "auto";

  const rowContainer = document.createElement("div");
  rowContainer.id = "row-container";
  rowContainer.style.position = "relative";
  scrollContainer.appendChild(rowContainer);

  const buffer = options.buffer ?? DEFAULT_BUFFER;

  const vpH = scrollContainer.clientHeight;
  const visibleRows = Math.ceil(vpH / options.rowHeight) + 1;
  const poolSize = visibleRows + buffer + buffer;

  const pool = new Pool({
    rowContainer,
    rowHeight: options.rowHeight,
    size: poolSize,
  }).create();

  // states
  let data: readonly T[] = [];
  let _range = { start: 0, end: 0 };
  let _destroyed = false;

  // Pool node → task index. -1 means unbound.
  const _nodeToTaskIdx = new Int32Array(poolSize).fill(-1);

  // Reused per call to avoid allocating a Set on every range change.
  const _scratchBoundArray: boolean[] = [];
  let _scanFrom = 0;

  function _findFreeNode(): number {
    for (let i = _scanFrom; i < poolSize; i++) {
      if (_nodeToTaskIdx[i] === -1) {
        _scanFrom = i + 1;
        return i;
      }
    }
    return -1;
  }

  function _update() {
    if (_destroyed) return;

    let newRange = computeRange({
      scrollTop: scrollContainer.scrollTop,
      vpHeight: scrollContainer.clientHeight,
      totalData: data.length,
      buffer,
      rowHeight: options.rowHeight,
    });

    if (newRange.start === _range.start && newRange.end === _range.end) return;
    _range = newRange;
    _applyRange();
  }

  function _applyRange() {
    const start = _range.start;
    const end = _range.end;

    //  release out-of-range bindings.
    for (let nodeIdx = 0; nodeIdx < poolSize; nodeIdx++) {
      const taskIdx = _nodeToTaskIdx[nodeIdx];
      if (taskIdx < 0) continue; // already free
      if (taskIdx >= start && taskIdx < end) continue; // still in range
      const node = pool.findByIndex(nodeIdx);
      pool.unbind(nodeIdx);
      pool.hide(nodeIdx);
      _nodeToTaskIdx[nodeIdx] = -1;
    }

    // Which rows already have a node?
    const bound = _scratchBoundArray;
    bound.length = 0; // reset reused array's effective size
    for (let nodeIdx = 0; nodeIdx < poolSize; nodeIdx++) {
      const t = _nodeToTaskIdx[nodeIdx];
      if (t >= 0) bound[t] = true;
    }
    _scanFrom = 0;

    // Bind free nodes to rows that entered the range.
    for (let taskIdx = start; taskIdx < end; taskIdx++) {
      if (bound[taskIdx]) continue; //already bound
      const taskData = data[taskIdx];
      if (taskData == null) continue;

      const nodeIdx = _findFreeNode();
      if (nodeIdx < 0) {
        console.error("ScrollRing: pool exhausted", { poolSize, start, end });
        break;
      }

      const dataId = _getDataId(taskData, taskIdx);
      const node = pool.findByIndex(nodeIdx);
      pool.bind(nodeIdx, dataId);
      pool.position(nodeIdx, taskIdx * options.rowHeight);
      _nodeToTaskIdx[nodeIdx] = taskIdx;
      // renderRow MUST mutate node in place. Errors are caught & logged;
      // an exception in user code never breaks the library.
      try {
        options.renderRow(node, taskData, { index: taskIdx });
      } catch (e) {
        console.log(e, { fn: "renderRow", taskIdx: taskIdx });
      }

      pool.show(nodeIdx);
    }

    // Clean reusable array — clears refs held by `bound[i] = true` slots.
    for (let i = start; i < end; i++) bound[i] = false;
  }

  function setData(newData: readonly T[]): void {
    if (_destroyed) throw new Error("ScrollRing: instance destroyed");
    if (!Array.isArray(newData)) {
      throw new TypeError("ScrollRing: data must be an array");
    }
    data = newData;
    rowContainer.style.height = `${data.length * options.rowHeight}px`;

    // Drop every binding so the next render redraws all rows with the new data.
    for (let i = 0; i < poolSize; i++) {
      if (_nodeToTaskIdx[i] !== -1) {
        pool.unbind(i);
        pool.hide(i);
        _nodeToTaskIdx[i] = -1;
      }
    }
    _range = { start: 0, end: 0 };

    _update();
  }

  // ── Scroll handler ─────────────────────────────────────────────
  function _onScroll() {
    _update();
  }

  function scrollToIndex(index: number): void {
    if (_destroyed || data.length === 0) return;
    const i = Math.max(0, Math.min(Math.floor(index), data.length - 1));
    scrollContainer.scrollTop = i * options.rowHeight;
  }

  function destroy(): void {
    if (_destroyed) return;
    _destroyed = true;
    scrollContainer.removeEventListener("scroll", _onScroll);
    pool.destroy();
    rowContainer.remove();
  }

  scrollContainer.addEventListener("scroll", _onScroll, { passive: true });

  return { setData, scrollToIndex, destroy };
}

function _getDataId(item: any, fallbackIdx: number) {
  if (item && item.id !== undefined && item.id !== null) return String(item.id);
  return String(fallbackIdx);
}

function _resolveElement(elementId: string): HTMLElement {
  let container =
    typeof elementId === "string"
      ? document.getElementById(elementId)
      : elementId;

  if (!container || typeof container.appendChild !== "function") {
    throw new Error(
      "ScrollRing.create" + elementId + "not found or not an dom element",
    );
  }
  return container;
}
