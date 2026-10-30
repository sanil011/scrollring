import { createScrollRing } from "../src/index";

const ds = createScrollRing({
  scrollContainer: "list",
  rowHeight: 40,
  renderRow(node, item, ctx) {
    node.textContent = item.name;
    node.classList.toggle("alt", ctx.index % 2 !== 0);
  },
});

const data = Array.from({ length: 100000 }, (_, i) => ({
  id: i,
  name: "Row " + (i + 1),
}));

ds.setData(data);

// const elem = document.getElementById('list')
// const fragment = document.createDocumentFragment();
// for (let i = 0; i < data.length; i++){
//   const div = document.createElement('div');
//   let elem = data[i]
//   div.innerHTML = `<h1>${elem.name}</h1>`;
//   fragment.appendChild(div)
// }
// elem.appendChild(fragment)
