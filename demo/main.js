import { createScrollRing } from "../src/index";

const TOTAL = 100_000;
const ROW_HEIGHT = 40;

const list = document.getElementById("list");
const flashToggle = document.getElementById("flash");
const stat = {
  total: document.getElementById("stat-total"),
  nodes: document.getElementById("stat-nodes"),
  window: document.getElementById("stat-window"),
  painted: document.getElementById("stat-painted"),
};

// Stats for the panel, collected from renderRow calls.
let paintedSinceUpdate = 0;
let statsQueued = false;

// A node's slot is its position among the row nodes. Nodes never move, so
// cache it instead of searching the DOM on every render.
const slotOf = new WeakMap();
function getSlot(node) {
  let slot = slotOf.get(node);
  if (slot === undefined) {
    slot = Array.prototype.indexOf.call(node.parentElement.children, node);
    slotOf.set(node, slot);
  }
  return slot;
}

const ring = createScrollRing({
  scrollContainer: "list",
  rowHeight: ROW_HEIGHT,
  renderRow(node, item, { index }) {
    node.textContent = item.name;
    node.classList.toggle("alt", index % 2 === 1);
    node.dataset.slot = getSlot(node);

    if (flashToggle.checked) {
      node.animate(
        [{ backgroundColor: "#fff1b8" }, { backgroundColor: "transparent" }],
        { duration: 500 },
      );
    }

    paintedSinceUpdate++;
    queueStats();
  },
});

const data = Array.from({ length: TOTAL }, (_, i) => ({
  id: i,
  name: "Row " + (i + 1),
}));
ring.setData(data);

// Update the panel once per frame, after all renderRow calls of that frame.
function queueStats() {
  if (statsQueued) return;
  statsQueued = true;
  requestAnimationFrame(updateStats);
}

function updateStats() {
  statsQueued = false;
  const fmt = (n) => n.toLocaleString("en-US");
  const shown = [...list.querySelectorAll(".scroll-row")].filter(
    (n) => n.style.display !== "none",
  );
  // Row numbers as shown in the list ("Row 1" is the first).
  const rows = shown.map((n) => Number(n.textContent.slice("Row ".length)));

  stat.total.textContent = fmt(TOTAL);
  stat.nodes.textContent = fmt(list.querySelectorAll(".scroll-row").length);
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

document.getElementById("jump").addEventListener("submit", (e) => {
  e.preventDefault();
  const n = Number(document.getElementById("jump-index").value);
  if (n >= 1) ring.scrollToIndex(n - 1);
});

for (const button of document.querySelectorAll("[data-height]")) {
  button.addEventListener("click", () => {
    list.style.height = button.dataset.height + "px";
    for (const b of document.querySelectorAll("[data-height]")) {
      b.setAttribute("aria-pressed", String(b === button));
    }
  });
}

// setData above already queued the first stats update.
