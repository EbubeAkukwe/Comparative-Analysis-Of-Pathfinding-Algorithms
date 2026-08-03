// core/DynamicObstacleEngine.js
import { EventBus } from "./EventBus.js";

/**
 * Moves existing wall cells around the grid randomly,
 * one step per tick, at the same speed as the animation delay.
 */
export class DynamicObstacleEngine {
  constructor(grid, renderer) {
    this._grid = grid;
    this._renderer = renderer;
    this._timerId = null;
    this.delay = 18; // kept in sync with runner.delay
  }

  /** Collect all current walls and start moving them. */
  start() {
    this.stop();
    this._tick();
  }

  stop() {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  get running() {
    return this._timerId !== null;
  }

  _tick() {
    this._moveAll();
    this._timerId = setTimeout(() => this._tick(), this.delay);
  }

  _moveAll() {
    const grid = this._grid;

    // Snapshot current wall positions so moves don't cascade in one tick
    const walls = [];
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++)
        if (grid.cells[r][c].state === "wall") walls.push({ r, c });

    if (walls.length === 0) return;

    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (const { r, c } of walls) {
      // Cell may have already been vacated this tick — re-check
      if (grid.cells[r][c].state !== "wall") continue;

      // Shuffle directions
      const shuffled = dirs.slice().sort(() => Math.random() - 0.5);

      for (const [dr, dc] of shuffled) {
        const nr = r + dr;
        const nc = c + dc;
        const target = grid.cell(nr, nc);

        if (!target) continue;
        if (target.state !== "open") continue; // occupied

        // Move: erase old, place new
        grid.cells[r][c].state = "open";
        grid.cells[nr][nc].state = "wall";

        // Redraw both cells on the static layer
        this._renderer.drawCell(grid, r, c);
        this._renderer.drawCell(grid, nr, nc);

        // Notify runner (lets D* Lite replan)
        EventBus.emit("grid:changed", { r, c });
        EventBus.emit("grid:changed", { r: nr, c: nc });

        break; // only move each wall once per tick
      }
    }
  }
}
