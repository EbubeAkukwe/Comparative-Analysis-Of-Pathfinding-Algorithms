/**
 * PathLab — Grid
 * Core data model. Holds the node matrix, start/goal positions,
 * and all terrain modification logic.
 *
 * Node states:
 *   'open'    — traversable, unvisited
 *   'wall'    — impassable obstacle
 *   'start'   — start position (exactly one)
 *   'goal'    — goal position (exactly one)
 *
 * Visualization states (set by AlgorithmRunner, cleared before runs):
 *   'visited' — expanded by an algorithm
 *   'path'    — part of the final path
 *   'frontier'— in the open set (not currently used for display)
 */
export class Grid {
  /**
   * @param {number} rows
   * @param {number} cols
   */
  constructor(rows, cols) {
    this.rows = 0;
    this.cols = 0;
    this.cells = [];
    this.start = { r: 0, c: 0 };
    this.goal = { r: 0, c: 0 };
    this.resize(rows, cols);
  }

  // ── Setup ──────────────────────────────────────

  /**
   * Resize the grid, preserving start/goal positions where possible.
   * @param {number} rows
   * @param {number} cols
   */
  resize(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => this._makeCell(r, c)),
    );
    // Default start/goal: vertically centred, near left/right edges
    this.start = { r: Math.floor(rows / 2), c: 2 };
    this.goal = { r: Math.floor(rows / 2), c: cols - 3 };
    this._setRaw(this.start.r, this.start.c, "start");
    this._setRaw(this.goal.r, this.goal.c, "goal");
  }

  /** Factory for a fresh open cell. */
  _makeCell(r, c) {
    return { r, c, state: "open", weight: 1.0 };
  }

  // ── Cell access ────────────────────────────────

  /**
   * Return the cell at (r, c), or null if out of bounds.
   * @param {number} r
   * @param {number} c
   * @returns {{r:number,c:number,state:string,weight:number}|null}
   */
  cell(r, c) {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.cells[r][c];
  }

  /**
   * True if (r, c) is out of bounds or a wall.
   * @param {number} r
   * @param {number} c
   * @returns {boolean}
   */
  isWall(r, c) {
    const cell = this.cell(r, c);
    return !cell || cell.state === "wall";
  }

  /** Internal: set state without checks. */
  _setRaw(r, c, state) {
    if (this.cells[r]?.[c]) this.cells[r][c].state = state;
  }

  // ── Neighbors ──────────────────────────────────

  /**
   * Traversable neighbors of (r, c).
   * @param {number} r
   * @param {number} c
   * @param {boolean} [dirs8=false] — include diagonals
   * @returns {Array<{r,c,state,weight}>}
   */
  neighbors(r, c, dirs8 = false) {
    const moves = dirs8
      ? [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]
      : [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];

    return moves
      .map(([dr, dc]) => this.cell(r + dr, c + dc))
      .filter((cell) => cell !== null && cell.state !== "wall");
  }

  /**
   * Edge cost between two adjacent cells.
   * Diagonal moves cost √2; cardinal moves cost 1.
   * Cell weight multiplies the base cost.
   * @param {{r,c}} a
   * @param {{r,c}} b
   * @returns {number}
   */
  edgeCost(a, b) {
    const base =
      Math.abs(a.r - b.r) + Math.abs(a.c - b.c) > 1 ? Math.SQRT2 : 1.0;
    // Average the weights of the two cells
    const cellA = this.cell(a.r, a.c);
    const cellB = this.cell(b.r, b.c);
    const avgWeight = ((cellA?.weight ?? 1) + (cellB?.weight ?? 1)) / 2;
    return base * avgWeight;
  }

  // ── Terrain modification ───────────────────────

  /**
   * Set a cell to wall, respecting start/goal.
   * @param {number} r
   * @param {number} c
   * @returns {boolean} true if changed
   */
  placeWall(r, c) {
    const cell = this.cell(r, c);
    if (!cell || cell.state === "start" || cell.state === "goal") return false;
    if (cell.state === "wall") return false;
    cell.state = "wall";
    return true;
  }

  /**
   * Remove a wall at (r, c).
   * @param {number} r
   * @param {number} c
   * @returns {boolean} true if changed
   */
  eraseWall(r, c) {
    const cell = this.cell(r, c);
    if (!cell || cell.state !== "wall") return false;
    cell.state = "open";
    return true;
  }

  /**
   * Move the start node to (r, c).
   * @param {number} r
   * @param {number} c
   * @returns {boolean} true if moved
   */
  moveStart(r, c) {
    const cell = this.cell(r, c);
    if (!cell || cell.state === "wall" || cell.state === "goal") return false;
    this._setRaw(this.start.r, this.start.c, "open");
    this.start = { r, c };
    cell.state = "start";
    return true;
  }

  /**
   * Move the goal node to (r, c).
   * @param {number} r
   * @param {number} c
   * @returns {boolean} true if moved
   */
  moveGoal(r, c) {
    const cell = this.cell(r, c);
    if (!cell || cell.state === "wall" || cell.state === "start") return false;
    this._setRaw(this.goal.r, this.goal.c, "open");
    this.goal = { r, c };
    cell.state = "goal";
    return true;
  }

  // ── State reset ────────────────────────────────

  /**
   * Clear all visualization states (visited / path) but keep walls.
   */
  clearVisualization() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (
          cell.state === "visited" ||
          cell.state === "path" ||
          cell.state === "frontier"
        ) {
          cell.state = "open";
        }
        // Clear algorithm metadata
        delete cell._visitOrder;
        delete cell._gScore;
        delete cell._fScore;
      }
    }
  }

  /**
   * Full reset — clear walls, visited, reset start/goal to defaults.
   */
  clearAll() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        this.cells[r][c] = this._makeCell(r, c);

    this.start = { r: Math.floor(this.rows / 2), c: 2 };
    this.goal = { r: Math.floor(this.rows / 2), c: this.cols - 3 };
    this._setRaw(this.start.r, this.start.c, "start");
    this._setRaw(this.goal.r, this.goal.c, "goal");
  }

  /**
   * Clear only walls (keep start/goal, clear visited).
   */
  clearWalls() {
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (
          cell.state === "wall" ||
          cell.state === "visited" ||
          cell.state === "path"
        )
          cell.state = "open";
      }
  }

  // ── Terrain generators ─────────────────────────

  /**
   * Recursive-backtracker DFS maze.
   * Guarantees a perfect maze (exactly one path between any two open cells).
   * Works best when rows and cols are both odd.
   */
  generateMaze() {
    // Fill everything with walls
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) this.cells[r][c].state = "wall";

    const visited = new Set();

    const carve = (r, c) => {
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
      const key = `${r},${c}`;
      if (visited.has(key)) return;
      visited.add(key);
      this.cells[r][c].state = "open";

      // Randomise cardinal directions
      const dirs = [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ].sort(() => Math.random() - 0.5);
      for (const [dr, dc] of dirs) {
        const nr = r + dr,
          nc = c + dc;
        if (
          !visited.has(`${nr},${nc}`) &&
          nr > 0 &&
          nr < this.rows - 1 &&
          nc > 0 &&
          nc < this.cols - 1
        ) {
          // Knock out the wall between current and next
          const mr = r + dr / 2,
            mc = c + dc / 2;
          this.cells[mr][mc].state = "open";
          carve(nr, nc);
        }
      }
    };

    // Start carving from an odd cell near top-left
    const sr = 1,
      sc = 1;
    carve(sr, sc);

    // Restore start/goal
    this._setRaw(this.start.r, this.start.c, "open");
    this._setRaw(this.goal.r, this.goal.c, "open");

    // Make sure start/goal are reachable (open their immediate neighbours)
    this._forceOpen(this.start.r, this.start.c);
    this._forceOpen(this.goal.r, this.goal.c);

    this._setRaw(this.start.r, this.start.c, "start");
    this._setRaw(this.goal.r, this.goal.c, "goal");
  }

  /** Open a cell and at least one cardinal neighbour to ensure connectivity. */
  _forceOpen(r, c) {
    const cell = this.cell(r, c);
    if (!cell) return;
    cell.state = "open";
    const cardinals = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dr, dc] of cardinals) {
      const nb = this.cell(r + dr, c + dc);
      if (nb && nb.state === "wall") {
        nb.state = "open";
        break;
      }
    }
  }

  /**
   * Randomly place walls at the given density (0–1).
   * Leaves start and goal untouched; does not guarantee a path.
   * @param {number} [density=0.30]
   */
  scatterWalls(density = 0.3) {
    this.clearVisualization();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.state === "start" || cell.state === "goal") continue;
        if (Math.random() < density) cell.state = "wall";
        else if (cell.state !== "open") cell.state = "open";
      }
    }
  }

  placeRandomWall(agentPos, minDist = 2) {
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        if (cell.state !== "open") continue;
        const dist = Math.max(
          Math.abs(r - agentPos.r),
          Math.abs(c - agentPos.c),
        );
        if (dist < minDist) continue;
        candidates.push(cell);
      }
    }
    if (!candidates.length) return null;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    picked.state = "wall";
    return { r: picked.r, c: picked.c };
  }

  // ── Serialisation ──────────────────────────────

  /**
   * Export a minimal snapshot for sharing or persistence.
   * @returns {Object}
   */
  snapshot() {
    const walls = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.cells[r][c].state === "wall") walls.push([r, c]);

    return {
      rows: this.rows,
      cols: this.cols,
      start: { ...this.start },
      goal: { ...this.goal },
      walls,
    };
  }

  /**
   * Restore from a snapshot.
   * @param {Object} snap
   */
  restore(snap) {
    this.resize(snap.rows, snap.cols);
    this.clearAll();
    this.moveStart(snap.start.r, snap.start.c);
    this.moveGoal(snap.goal.r, snap.goal.c);
    for (const [r, c] of snap.walls) this.placeWall(r, c);
  }

  // ── Utilities ──────────────────────────────────

  /**
   * Unique string key for a cell or {r,c} object.
   * @param {{r:number,c:number}} cell
   * @returns {string}
   */
  static key(cell) {
    return `${cell.r},${cell.c}`;
  }

  /** Count cells matching a given state. */
  count(state) {
    let n = 0;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        if (this.cells[r][c].state === state) n++;
    return n;
  }

  /** Total traversable cells (open + start + goal). */
  get traversableCount() {
    return this.rows * this.cols - this.count("wall");
  }
}
