import { createScrollRing } from "../src/index";

const ds = createScrollRing({
  scrollContainer: "scroll-container",
  rowHeight: 40,
  renderRow(node, item, ctx) {
    node.textContent = item.name;
    node.classList.toggle("alt", ctx.index % 2 !== 0);
  },
});

const data = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: "Row " + (i + 1),
}));

ds.setData(data);
