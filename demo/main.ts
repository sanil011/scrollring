import { createScrollRing } from "../src/index";

const TOTAL = 100_000;
const ITEM_HEIGHT = 40;

interface Row {
  id: number;
  name: string;
}

// The demo page is static, so a missing element is a bug in index.html.
function byId<E extends HTMLElement = HTMLElement>(id: string): E {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as E;
}

const list = byId("list");
const flashToggle = byId<HTMLInputElement>("flash");
const stat = {
  total: byId("stat-total"),
  nodes: byId("stat-nodes"),
  window: byId("stat-window"),
  painted: byId("stat-painted"),
};

// Stats for the panel, collected from renderItem calls.
let paintedSinceUpdate = 0;
let statsQueued = false;

// Respect the OS "reduce motion" setting.
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  flashToggle.checked = false;
}

// Read the flash color from CSS so it follows light and dark mode.
const ROW_FLASH = getComputedStyle(document.documentElement)
  .getPropertyValue("--flash")
  .trim();

// A node's slot is its position among the row nodes. Nodes never move, so
// cache it instead of searching the DOM on every render.
const slotOf = new WeakMap<HTMLElement, number>();
function getSlot(node: HTMLElement): number {
  let slot = slotOf.get(node);
  if (slot === undefined) {
    slot = Array.prototype.indexOf.call(node.parentElement!.children, node);
    slotOf.set(node, slot);
  }
  return slot;
}

const ring = createScrollRing<Row>({
  container: "list",
  itemHeight: ITEM_HEIGHT,
  renderItem(node, item, { index }) {
    node.textContent = item.name;
    node.classList.toggle("alt", index % 2 === 1);
    node.dataset.slot = String(getSlot(node));

    if (flashToggle.checked) {
      node.animate(
        [{ backgroundColor: ROW_FLASH }, { backgroundColor: "transparent" }],
        { duration: 500 },
      );
    }

    paintedSinceUpdate++;
    queueStats();
  },
});

const data: Row[] = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  name: "Row " + (i + 1),
}));
ring.setData(data);

// Update the panel once per frame, after all renderItem calls of that frame.
function queueStats() {
  if (statsQueued) return;
  statsQueued = true;
  requestAnimationFrame(updateStats);
}

function updateStats() {
  statsQueued = false;
  const fmt = (n: number) => n.toLocaleString("en-US");
  const nodes = [...list.querySelectorAll<HTMLElement>(".scroll-row")];
  const shown = nodes.filter((n) => n.style.display !== "none");
  // Row numbers as shown in the list ("Row 1" is the first).
  const rows = shown.map((n) => Number(n.textContent!.slice("Row ".length)));

  stat.total.textContent = fmt(TOTAL);
  stat.nodes.textContent = fmt(nodes.length);
  stat.window.textContent = rows.length
    ? `${fmt(Math.min(...rows))} – ${fmt(Math.max(...rows))}`
    : "-";
  stat.painted.textContent = fmt(paintedSinceUpdate);

  paintedSinceUpdate = 0;
}

// Scrolls that stay inside the same window repaint nothing, so show 0.
list.addEventListener(
  "scroll",
  () => {
    if (paintedSinceUpdate === 0) queueStats();
  },
  { passive: true },
);

byId("jump").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = Number(byId<HTMLInputElement>("jump-index").value);
  if (n >= 1) ring.scrollToIndex(n - 1);
});

byId("random").addEventListener("click", () => {
  const n = 1 + Math.floor(Math.random() * TOTAL);
  byId<HTMLInputElement>("jump-index").value = String(n);
  ring.scrollToIndex(n - 1);
});

const copyButton = byId("copy");
copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(byId("install-cmd").textContent!);
    copyButton.textContent = "Copied";
  } catch {
    copyButton.textContent = "Press ⌘C";
  }
  setTimeout(() => (copyButton.textContent = "Copy"), 1500);
});

for (const button of document.querySelectorAll<HTMLElement>("[data-height]")) {
  button.addEventListener("click", () => {
    list.style.height = button.dataset.height + "px";
    for (const b of document.querySelectorAll("[data-height]")) {
      b.setAttribute("aria-pressed", String(b === button));
    }
  });
}
