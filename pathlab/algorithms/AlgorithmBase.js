/**
 * PathLab — AlgorithmBase
 * Abstract base class. Every algorithm extends this.
 *
 * The solve() method must be a generator function that yields
 * step objects of these shapes:
 *
 *   { type: 'visit',  r, c, cost }       — node expanded from open set
 *   { type: 'path',   r, c }             — node on reconstructed path
 *   { type: 'done',   success: boolean,
 *                     path: Array<{r,c}>,
 *                     nodesExpanded: number,
 *                     pathCost: number }  — algorithm has finished
 *
 * The 'done' step must always be yielded — even on failure.
 */
import { getHeuristic } from "../core/Heuristics.js";
import { Grid } from "../core/Grid.js";

export class AlgorithmBase {
  /**
   * @param {Grid}   grid
   * @param {string} heuristic  — 'manhattan' | 'euclidean' | 'chebyshev'
   * @param {boolean} dirs8     — true = 8-directional movement
   */
  constructor(grid, heuristic = "manhattan", dirs8 = false) {
    this.grid = grid;
    this.h = getHeuristic(heuristic);
    this.dirs8 = dirs8;
  }

  /** @abstract */
  *solve() {
    throw new Error(`${this.constructor.name} must implement solve()`);
  }

  /**
   * Rough memory estimate in bytes for typical search-algorithm structures.
   * Each Map/Set entry on V8 costs roughly this much overhead for a
   * string key + small value (heap object headers + hash bucket slot).
   * Not exact — but consistent and useful for relative comparison.
   */
  estimateBytes(entryCount) {
    const BYTES_PER_ENTRY = 48; // approx: key string + value + map overhead
    return entryCount * BYTES_PER_ENTRY;
  }

  // ── Shared utilities ───────────────────────────

  /**
   * Reconstruct a path by walking the cameFrom map backwards.
   * Returns an array from start → goal.
   * @param {Map<string, {r,c}|null>} cameFrom
   * @param {{r,c}} current  — should be the goal cell
   * @returns {Array<{r,c}>}
   */
  reconstructPath(cameFrom, current) {
    const path = [];
    let node = current;
    while (node !== null && node !== undefined) {
      path.unshift({ r: node.r, c: node.c });
      const key = Grid.key(node);
      node = cameFrom.get(key) ?? null;
    }
    return path;
  }

  /**
   * Compute total cost of a path.
   * @param {Array<{r,c}>} path
   * @returns {number}
   */
  pathCost(path) {
    let cost = 0;
    for (let i = 1; i < path.length; i++) {
      cost += this.grid.edgeCost(path[i - 1], path[i]);
    }
    return cost;
  }

  /** Shorthand: get the start cell. */
  get startCell() {
    return this.grid.cell(this.grid.start.r, this.grid.start.c);
  }

  /** Shorthand: get the goal cell. */
  get goalCell() {
    return this.grid.cell(this.grid.goal.r, this.grid.goal.c);
  }

  /** True if a cell matches the goal position. */
  isGoal(cell) {
    return cell.r === this.grid.goal.r && cell.c === this.grid.goal.c;
  }
}
