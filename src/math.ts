// -----------------------------------
// ComputeRange - primary scroll-window calculation
// -----------------------------------

type ComputeRangeOptions = {
  scrollTop: number;
  vpHeight: number;
  rowHeight: number;
  totalData: number;
  buffer: number;
};

type ComputeRangeResult = {
  start: number;
  end: number;
};

/**
 * Compute the [start,end] row index range to render given scroll state.
 * O(1) - fixed row height and pure integer arithmetic.
 * @param {number} options.scrollTop  Scroll offset in px (>= 0)
 * @param {number} options.vpHeight   viewport height px (> 0)
 * @param {number} options.rowHeight  row height (> 0)
 * @param {number} options.totalData  total row count (> 0)
 * @param {number} options.buffer     extra row count (> 0)
 * @returns {{start:number, end:number}}
 */

export function computeRange({
  scrollTop,
  vpHeight,
  rowHeight,
  totalData,
  buffer,
}: ComputeRangeOptions): ComputeRangeResult {

  if (totalData <= 0) return { start: 0, end: 0 };
  if (rowHeight <= 0) return { start: 0, end: 0 };
  if (scrollTop < 0) scrollTop = 0;

  let visStart = Math.floor(scrollTop / rowHeight) ;
  let visEnd = Math.ceil((scrollTop + vpHeight) / rowHeight);

  let start = visStart - buffer;
  let end = visEnd + buffer;
  if (start < 0) start = 0;
  if (end > totalData) end = totalData;
  if (start > end) start = end;

  return { start, end };
}


export function maxWindowSize(
  vpHeight: number,
  rowHeight: number,
  buffer: number,
): number {
  return Math.ceil(vpHeight / rowHeight) + 1 + 2 * buffer;
}

