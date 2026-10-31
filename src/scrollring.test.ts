// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createScrollRing } from "./scrollring";

interface Item {
  id: number;
  name: string;
}
const makeItems = (n: number, prefix = "Row "): Item[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, name: prefix + (i + 1) }));

// jsdom has no layout, so fake the two numbers the library reads.
function makeContainer(height = 400, id = "list") {
  const el = document.createElement("div");
  el.id = id;
  let top = 0;
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => height,
  });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  document.body.appendChild(el); // must be attached, or getElementById won't find it
  return el;
}

function scrollTo(el: HTMLElement, top: number) {
  el.scrollTop = top;
  el.dispatchEvent(new Event("scroll"));
}

function shownRows(el: HTMLElement) {
  return [...el.querySelectorAll<HTMLElement>(".scroll-row")]
    .filter((n) => n.style.display !== "none")
    .map((n) => n.textContent);
}

describe("createScrollRing", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = makeContainer(400, "list");
  });
  const create = () =>
    createScrollRing<Item>({
      scrollContainer: "list",
      rowHeight: 40,
      buffer: 2,
      renderRow: (node:any, item:any) => {
        node.textContent = item.name;
      },
    });

  it("creates exactly maxWindowSize pool nodes", () => {
    create();
    expect(container.querySelectorAll(".scroll-row")).toHaveLength(15); // 10 + 1 + 2*2
  });

  it("shows each row in the window exactly once after scrolling", () => {
    const ring = create();
    ring.setData(makeItems(1000));

    scrollTo(container, 2020); // visible rows 50..60, window 48..62 = 15 rows (the pool is full)

    const shown = shownRows(container);
    expect(shown).toHaveLength(15);
    expect(new Set(shown).size).toBe(15); // no duplicates, so no ring collisions
    expect(shown).toContain("Row 49"); // index 48, first row in the window
    expect(shown).toContain("Row 63"); // index 62, last row in the window
  });

  it("keeps the number of DOM nodes constant while scrolling", () => {
    const ring = create();
    ring.setData(makeItems(1000));
    const before = container.querySelectorAll(".scroll-row").length;

    for (const top of [0, 400, 5000, 20_000, 39_600, 100])
      scrollTo(container, top);

    expect(container.querySelectorAll(".scroll-row")).toHaveLength(before);
  });

  it("positions rows at index * rowHeight", () => {
    const ring = create();
    ring.setData(makeItems(1000));
    scrollTo(container, 2020);

    const row49 = [
      ...container.querySelectorAll<HTMLElement>(".scroll-row"),
    ].find((n) => n.textContent === "Row 49")!;
    expect(row49.style.transform).toContain("1920px"); // 48 * 40
  });

  it("draws row i with the node at slot i % poolSize (ring assignment)", () => {
    const ring = create();
    ring.setData(makeItems(1000));
    const poolSize = 15;

    for (const top of [0, 2020, 13_337, 39_600]) {
      scrollTo(container, top);
      const nodes = [...container.querySelectorAll<HTMLElement>(".scroll-row")];
      nodes.forEach((node, slot) => {
        if (node.style.display === "none") return;
        const row = Number(node.textContent!.slice("Row ".length)) - 1;
        expect(row % poolSize).toBe(slot);
      });
    }
  });

  it("caps the window at the pool size if the container grows", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ring = create();
    ring.setData(makeItems(1000));

    // Taller than at creation, and there is no ResizeObserver yet.
    Object.defineProperty(container, "clientHeight", { get: () => 800 });
    scrollTo(container, 2020);

    const shown = shownRows(container);
    expect(shown).toHaveLength(15);
    expect(new Set(shown).size).toBe(15);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("redraws when setData is called with different data (regression)", () => {
    const ring = create();
    ring.setData(makeItems(1000, "A"));
    ring.setData(makeItems(1000, "B"));
    expect(shownRows(container)[0]).toBe("B1");
  });

  it("scrollToIndex clamps to the valid range", () => {
    const ring = create();
    ring.setData(makeItems(1000));

    ring.scrollToIndex(5);
    expect(container.scrollTop).toBe(200);
    ring.scrollToIndex(99_999);
    expect(container.scrollTop).toBe(999 * 40);
    ring.scrollToIndex(-3);
    expect(container.scrollTop).toBe(0);
  });

  it("destroy removes the nodes and stops listening", () => {
    const renderRow = vi.fn();
    const ring = createScrollRing<Item>({
      scrollContainer: "list",
      rowHeight: 40,
      renderRow,
    });
    ring.setData(makeItems(1000));
    ring.destroy();

    renderRow.mockClear();
    scrollTo(container, 5000);

    expect(container.querySelectorAll(".scroll-row")).toHaveLength(0);
    expect(renderRow).not.toHaveBeenCalled();
    expect(() => ring.setData(makeItems(5))).toThrow(/after destroy/);
  });

  it("survives a renderRow that throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ring = createScrollRing<Item>({
      scrollContainer: "list",
      rowHeight: 40,
      renderRow: () => {
        throw new Error("boom");
      },
    });

    expect(() => ring.setData(makeItems(10))).not.toThrow();
    spy.mockRestore();
  });

  it("rejects bad options with a clear message", () => {
    expect(() =>
      createScrollRing<Item>({
        scrollContainer: "list",
        rowHeight: 0,
        renderRow: () => {},
      }),
    ).toThrow(/rowHeight/);

    makeContainer(0, "flat"); // a container with no height
    expect(() =>
      createScrollRing<Item>({
        scrollContainer: "flat",
        rowHeight: 40,
        renderRow: () => {},
      }),
    ).toThrow("Scroll container has no height");

    expect(() =>
      createScrollRing<Item>({
        scrollContainer: "missing-id",
        rowHeight: 40,
        renderRow: () => {},
      }),
    ).toThrow(/not found/);
  });
});

// jsdom has no ResizeObserver. This fake lets a test fire the callback by hand.
class FakeResizeObserver {
  static last: FakeResizeObserver | null = null;
  disconnected = false;
  constructor(private callback: () => void) {
    FakeResizeObserver.last = this;
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  fire() {
    if (!this.disconnected) this.callback();
  }
}

describe("resizing the container", () => {
  let container: HTMLElement;
  let height = 400;

  beforeEach(() => {
    document.body.innerHTML = "";
    height = 400;
    container = makeContainer(400, "list");
    Object.defineProperty(container, "clientHeight", { get: () => height });
    FakeResizeObserver.last = null;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    return () => vi.unstubAllGlobals();
  });

  const create = () =>
    createScrollRing<Item>({
      scrollContainer: "list",
      rowHeight: 40,
      buffer: 2,
      renderRow: (node, item) => {
        node.textContent = item.name;
      },
    });
  const nodeCount = () => container.querySelectorAll(".scroll-row").length;

  it("grows the pool when the container gets taller", () => {
    const ring = create();
    ring.setData(makeItems(1000));
    scrollTo(container, 2020);

    height = 800;
    FakeResizeObserver.last!.fire();

    expect(nodeCount()).toBe(25); // ceil(800/40) + 1 + 2*2
    // visible rows 50..70, window 48..72 = 25 rows, all different
    const shown = shownRows(container);
    expect(shown).toHaveLength(25);
    expect(new Set(shown).size).toBe(25);
    expect(shown).toContain("Row 49");
    expect(shown).toContain("Row 73");
  });

  it("uses the new pool size for ring slots after growing", () => {
    const ring = create();
    ring.setData(makeItems(1000));
    height = 800;
    FakeResizeObserver.last!.fire();

    for (const top of [0, 2020, 13_337]) {
      scrollTo(container, top);
      const nodes = [...container.querySelectorAll<HTMLElement>(".scroll-row")];
      nodes.forEach((node, slot) => {
        if (node.style.display === "none") return;
        const row = Number(node.textContent!.slice("Row ".length)) - 1;
        expect(row % 25).toBe(slot);
      });
    }
  });

  it("keeps its nodes when the container gets shorter", () => {
    const ring = create();
    ring.setData(makeItems(1000));

    height = 200;
    FakeResizeObserver.last!.fire();

    expect(nodeCount()).toBe(15);
    // visible rows 0..4, window 0..6 = 7 rows
    expect(shownRows(container)).toHaveLength(7);
  });

  it("stops observing on destroy", () => {
    const ring = create();
    ring.destroy();
    expect(FakeResizeObserver.last!.disconnected).toBe(true);
  });
});
