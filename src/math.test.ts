import { describe, it, expect } from "vitest";
import { getWindow, maxWindowSize } from "./math";

const base = { viewportHeight: 400, rowHeight: 40, count: 1000, overscan: 0 };

describe("getWindow", () => {
  it("starts at the top", () => {
    expect(getWindow({ ...base, scrollTop: 0 })).toEqual({
      start: 0,
      end: 10,
    });
  });

  it("includes a row partly scrolled off the top (needs floor, not ceil", () => {
    expect(getWindow({ ...base, scrollTop: 2020 }).start).toBe(50);
  });

  it("includes a row partly visible at the bottom", () => {
    expect(getWindow({ ...base, scrollTop: 2020 }).end).toBe(61);
  });

  it("adds the overscan on both sides and clamps at 0", () => {
    expect(getWindow({ ...base, overscan: 5, scrollTop: 0 }).start).toBe(0);
    expect(getWindow({ ...base, overscan: 5, scrollTop: 2000 })).toEqual({
      start: 45,
      end: 65,
    });
  });

  it("clamps at the end of the list", () => {
    expect(getWindow({ ...base, overscan: 15, scrollTop: 39_000 }).end).toBe(
      1000,
    );
  });

  it.each([
    ["no data", { count: 0 }],
    ["zero row height", { rowHeight: 0 }],
  ])("returns an empty range for %s", (_name, override) => {
    expect(getWindow({ ...base, scrollTop: 100, ...override })).toEqual({
      start: 0,
      end: 0,
    });
  });
  it("treats negative scrollTop (macOS bounce) as 0", () => {
    expect(getWindow({ ...base, scrollTop: -80 })).toEqual(
      getWindow({ ...base, scrollTop: 0 }),
    );
  });

  it("never returns start > end, even far past the end", () => {
    const r = getWindow({ ...base, overscan: 5, scrollTop: 10_000_000 });
    expect(r.start).toBeLessThanOrEqual(r.end);
    expect(r.end).toBeLessThanOrEqual(1000);
  });
});

describe("window never exceeds the pool", () => {
  it.each([
    { viewportHeight: 400, rowHeight: 40, overscan: 5 },
    { viewportHeight: 398, rowHeight: 40, overscan: 50 },
    { viewportHeight: 405, rowHeight: 37, overscan: 3 }, // not round numbers on purpose
  ])("%o", ({ viewportHeight, rowHeight, overscan }) => {
    const count = 100_000;
    const max = maxWindowSize(viewportHeight, rowHeight, overscan);

    for (
      let scrollTop = -100;
      scrollTop <= count * rowHeight + 500;
      scrollTop += 7
    ) {
      const { start, end } = getWindow({
        scrollTop,
        viewportHeight,
        rowHeight,
        count,
        overscan,
      });
      expect(end - start).toBeLessThanOrEqual(max);
    }
  });
});