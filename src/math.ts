// Pure layout math for a fixed-row-height list. No DOM access, so it can be
// unit-tested in Node.

export interface WindowInput {
  /** Current scroll offset in px. Negative values (overscroll bounce) count as 0. */
  scrollTop: number;
  /** Visible height of the scroll container in px. */
  viewportHeight: number;
  /** Height of every row in px. */
  rowHeight: number;
  /** Number of rows in the list. */
  count: number;
  /** Extra rows to include above and below the visible ones. */
  overscan: number;
}

/** Rows `start` (inclusive) to `end` (exclusive). */
export interface RowWindow {
  start: number;
  end: number;
}

/**
 * Which rows should be in the DOM for the given scroll position.
 * Always returns `0 <= start <= end <= count`.
 */
export function getWindow({
  scrollTop,
  viewportHeight,
  rowHeight,
  count,
  overscan,
}: WindowInput): RowWindow {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 };

  const top = Math.max(0, scrollTop);
  // floor: a row cut off at the top is still partly visible.
  const firstVisible = Math.floor(top / rowHeight);
  // ceil: same for a row cut off at the bottom. Exclusive.
  const afterLastVisible = Math.ceil((top + viewportHeight) / rowHeight);

  const end = Math.min(count, afterLastVisible + overscan);
  // Past the end of the list `firstVisible` can be > end, so clamp to end.
  const start = Math.min(end, Math.max(0, firstVisible - overscan));
  return { start, end };
}

/**
 * The most rows `getWindow` can ever return for this viewport, which is
 * also the number of DOM nodes the list needs.
 *
 * A viewport of `n` rows' height can show parts of `ceil(n) + 1` rows
 * (one cut off at the top, one at the bottom), plus overscan on each side.
 */
export function maxWindowSize(
  viewportHeight: number,
  rowHeight: number,
  overscan: number,
): number {
  return Math.ceil(viewportHeight / rowHeight) + 1 + 2 * overscan;
}
