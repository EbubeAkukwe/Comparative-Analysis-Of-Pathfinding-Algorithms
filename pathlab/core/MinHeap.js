/**
 * PathLab — MinHeap
 * Generic binary min-heap priority queue.
 * Used by Dijkstra, A*, Greedy BFS, and D* Lite.
 *
 * Items can be any object; a comparator function
 * determines ordering (defaults to ascending numeric .f).
 */
export class MinHeap {
  /**
   * @param {(a: any, b: any) => number} comparator
   *   Returns negative if a < b (a has higher priority).
   *   Defaults to comparing .f property numerically.
   */
  constructor(comparator = (a, b) => a.f - b.f) {
    this._data = [];
    this._cmp  = comparator;
  }

  /** Number of items in the heap. */
  get size() { return this._data.length; }

  /** True if the heap is empty. */
  get empty() { return this._data.length === 0; }

  /** Peek at the top item without removing it. */
  get peek() { return this._data[0] ?? null; }

  /**
   * Insert an item.
   * O(log n)
   * @param {*} item
   */
  push(item) {
    this._data.push(item);
    this._siftUp(this._data.length - 1);
  }

  /**
   * Remove and return the top (minimum) item.
   * O(log n)
   * @returns {*}
   */
  pop() {
    if (this._data.length === 0) return null;
    const top  = this._data[0];
    const last = this._data.pop();
    if (this._data.length > 0) {
      this._data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  /**
   * Replace the top item with a new one and restore heap order.
   * More efficient than pop() + push() when used together.
   * O(log n)
   * @param {*} item
   * @returns {*} the old top item
   */
  replaceTop(item) {
    const old = this._data[0];
    this._data[0] = item;
    this._siftDown(0);
    return old;
  }

  /** Remove all items. */
  clear() { this._data = []; }

  /**
   * Convert to sorted array (non-destructive).
   * O(n log n)
   * @returns {Array}
   */
  toSortedArray() {
    const copy = new MinHeap(this._cmp);
    copy._data = [...this._data];
    const out = [];
    while (!copy.empty) out.push(copy.pop());
    return out;
  }

  // ── Internal ───────────────────────────────────

  _siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._cmp(this._data[i], this._data[parent]) < 0) {
        this._swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  _siftDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._cmp(this._data[l], this._data[smallest]) < 0) smallest = l;
      if (r < n && this._cmp(this._data[r], this._data[smallest]) < 0) smallest = r;
      if (smallest === i) break;
      this._swap(i, smallest);
      i = smallest;
    }
  }

  _swap(i, j) {
    const tmp      = this._data[i];
    this._data[i]  = this._data[j];
    this._data[j]  = tmp;
  }
}
