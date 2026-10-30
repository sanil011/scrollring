type PoolOptions = {
  rowContainer: HTMLElement;
  rowHeight: number;
  size: number;
};

export class Pool {
  rowContainer: HTMLElement;
  rowHeight: number;
  size: number;
  nodes: HTMLDivElement[];
  idToIdx: Map<string, number>;
  destroyed: boolean;

  constructor(options: PoolOptions) {
    this.rowContainer = options.rowContainer;
    this.rowHeight = options.rowHeight;
    this.size = options.size;

    this.nodes = new Array<HTMLDivElement>(this.size);
    this.idToIdx = new Map<string, number>();
    this.destroyed = false;
  }

  create(): this {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < this.size; i++) {
      const node = document.createElement("div");
      node.className = "scroll-row";

      const st = node.style;
      st.position = "absolute";
      st.top = "0";
      st.left = "0";
      st.right = "0";
      st.height = `${this.rowHeight}px`;
      st.boxSizing = "border-box";
      // translate3d (not plain translateY) forces GPU compositor layer.
      st.transform = "translate3d(0,0,0)";
      // Empty spaces inside pool nodes shouldn't capture clicks meant for the
      // row content provided by the consumer's renderRow callback.
      st.contain = "layout paint";
      st.display = "none";

      fragment.appendChild(node);
      this.nodes[i] = node;
    }

    this.rowContainer.appendChild(fragment);
    return this;
  }

  /** Direct node access by pool index. */
  findByIndex(idx: number):HTMLElement {
    this.alive("findByIndex");
    return this.nodes[idx];
  }

  bind(nodeIdx: number, dataId: number | string):void {
    this.alive("bind");
    const node = this.nodes[nodeIdx];
    const newId = String(dataId);
    const oldId = node.dataset.id;
    if (oldId == newId) return;
    if (oldId) this.idToIdx.delete(oldId);
    node.dataset.id = newId;
    this.idToIdx.set(newId, nodeIdx);
  }

  unbind(nodeIdx: number):void {
    this.alive("unbind");
    const node = this.nodes[nodeIdx];
    const id = node.dataset.id;
    if (id) {
      this.idToIdx.delete(id);
      delete node.dataset.id;
    }
  }

  /** Show node `nodeIdx`. */
  show(nodeIdx: number):void {
    this.alive("show");
    this.nodes[nodeIdx].style.display = "";
  }

  /**
   * Position node `nodeIdx` at vertical offset `y` (px) within container.
   * Uses translate3d to keep the node on its own compositor layer.
   */
  position(nodeIdx: number, y: number):void {
    this.alive("position");
    // Concatenation faster than template literal in hot path.
    this.nodes[nodeIdx].style.transform = "translate3d(0," + y + "px,0)";
  }

  hide(nodeIdx: number):void {
    this.alive("hide");
    this.nodes[nodeIdx].style.display = "none";
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const node of this.nodes) node.remove();
    this.idToIdx.clear();
  }

  private alive(op: string) {
    if (this.destroyed) {
      throw new Error("DScroll.pool." + op + ": pool has been destroyed");
    }
  }
}
