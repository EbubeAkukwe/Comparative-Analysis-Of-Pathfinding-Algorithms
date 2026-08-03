/**
 * PathLab — ECFEngine
 * Environment Change Frequency engine.
 *
 * Models dynamic obstacles as directed-sweep agents:
 * each obstacle has a position and a persistent heading.
 * Every tick it moves one step — vacating its current cell
 * and occupying the next — mimicking real-world moving obstacles
 * (pedestrians, vehicles, drifting debris).
 *
 * Obstacle count = ECF% of traversable cells at engine start.
 * Agents are seeded away from start/goal and visited nodes.
 * Supports both 4-directional and 8-directional movement,
 * matching whatever the user selects in the dashboard.
 */
import { EventBus } from "./EventBus.js";

const DIRS_4 = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

const DIRS_8 = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
  { r: -1, c: -1 },
  { r: -1, c: 1 },
  { r: 1, c: -1 },
  { r: 1, c: 1 },
];

export class ECFEngine {
  constructor(grid, renderer) {
    this._grid = grid;
    this._renderer = renderer;
    this._timer = null;
    this._agents = []; // { r, c, dir: {r, c} }
    this._agentPos = null; // current algorithm frontier, updated via setAgentPos()
    this._dirs = DIRS_4; // active direction set
  }

  // ── Public API ──────────────────────────────────

  /**
   * Seed obstacles and start the movement loop.
   * @param {number}  pct        — ECF percentage (5 / 10 / 15 / 20 / 30)
   * @param {number}  intervalMs — milliseconds between each agent move tick
   * @param {boolean} dirs8      — true = 8-directional movement
   */
  start(pct, intervalMs, dirs8 = false) {
    this.stop();
    if (pct <= 0 || intervalMs <= 0) return;

    this._dirs = dirs8 ? DIRS_8 : DIRS_4;
    this._wallColor = "#1a1e2a"; // dark fill matching PathLab's wall color
    this._hatchColor = "#2e3350"; // subtle hatch lines
    this._seedAgents(pct);
    this._timer = setInterval(() => this._tick(), intervalMs);
  }

  /**
   * Stop all agents and remove their walls from the grid.
   */
  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._clearAgents();
    this._agents = [];
    this._agentPos = null;
  }

  get isRunning() {
    return this._timer !== null;
  }

  /**
   * Called by main.js on every run:step event to keep the
   * safe-zone centered on the actual algorithm frontier.
   * @param {{ r: number, c: number }} pos
   */
  setAgentPos(pos) {
    this._agentPos = pos;
  }

  // ── Seeding ─────────────────────────────────────

  /**
   * Place the initial set of moving obstacles on the grid.
   * Count = pct% of traversable cells.
   * Placed at least 3 Chebyshev steps from start and goal.
   */
  _seedAgents(pct) {
    const grid = this._grid;
    const count = Math.max(1, Math.round(grid.traversableCount * (pct / 100)));
    const cs = this._renderer.cellSize;

    // Collect candidate open cells far enough from start and goal
    const candidates = [];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r][c];
        if (cell.state !== "open") continue;

        const dStart = Math.max(
          Math.abs(r - grid.start.r),
          Math.abs(c - grid.start.c),
        );
        const dGoal = Math.max(
          Math.abs(r - grid.goal.r),
          Math.abs(c - grid.goal.c),
        );
        if (dStart < 3 || dGoal < 3) continue;

        candidates.push({ r, c });
      }
    }

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Seed up to count agents, no overlaps
    const placed = new Set();
    for (const pos of candidates) {
      if (this._agents.length >= count) break;
      const key = `${pos.r},${pos.c}`;
      if (placed.has(key)) continue;

      const dir = this._dirs[Math.floor(Math.random() * this._dirs.length)];
      grid.cells[pos.r][pos.c].state = "wall";
      // Draw on dynamic layer so it sits above heatmap correctly
      const ctx = this._renderer._octx; // overlay, not dynamic
      ctx.fillStyle = this._wallColor;
      ctx.fillRect(pos.c * cs + 1, pos.r * cs + 1, cs - 2, cs - 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(pos.c * cs + 1, pos.r * cs + 1, cs - 2, cs - 2);
      ctx.clip();
      ctx.strokeStyle = this._hatchColor;
      ctx.lineWidth = 0.8;
      const step = Math.max(4, cs * 0.3);
      for (let i = -cs; i < cs * 2; i += step) {
        ctx.beginPath();
        ctx.moveTo(pos.c * cs + i, pos.r * cs);
        ctx.lineTo(pos.c * cs + i + cs, pos.r * cs + cs);
        ctx.stroke();
      }
      ctx.restore();

      this._agents.push({ r: pos.r, c: pos.c, dir: { ...dir } });
      placed.add(key);
    }
  }

  /**
   * Remove all agent walls from the grid and redraw those cells.
   */
  _clearAgents() {
    const cs = this._renderer.cellSize;
    const octx = this._renderer._octx;
    for (const agent of this._agents) {
      const cell = this._grid.cell(agent.r, agent.c);
      if (cell && cell.state === "wall") {
        cell.state = "open";
        octx.clearRect(agent.c * cs, agent.r * cs, cs, cs);
        this._renderer.drawCell(this._grid, agent.r, agent.c);
      }
    }
  }

  // ── Tick — move every agent one step ────────────

  /**
   * Move each agent according to directed-sweep logic:
   * try to continue in current direction, deflect if blocked.
   */
  _tick() {
    const grid = this._grid;
    const frontier = this._agentPos ?? grid.start;
    const cs = this._renderer.cellSize;
    const octx = this._renderer._octx;

    for (const agent of this._agents) {
      const next = this._nextCell(agent, frontier);

      // ── Vacate current cell ──
      const curCell = grid.cell(agent.r, agent.c);
      if (curCell && curCell.state === "wall") {
        curCell.state = "open";
        // Clear ECF wall from overlay — heatmap on _dctx untouched
        octx.clearRect(agent.c * cs, agent.r * cs, cs, cs);
        // Restore static layer grid line at vacated cell
        this._renderer.drawCell(grid, agent.r, agent.c);
      }

      // ── Occupy next cell ──
      const nxtCell = grid.cell(next.r, next.c);
      if (nxtCell && nxtCell.state === "open") {
        nxtCell.state = "wall";
        // Draw wall on overlay — sits above heatmap without touching it
        octx.fillStyle = this._wallColor;
        octx.fillRect(next.c * cs + 1, next.r * cs + 1, cs - 2, cs - 2);
        octx.save();
        octx.beginPath();
        octx.rect(next.c * cs + 1, next.r * cs + 1, cs - 2, cs - 2);
        octx.clip();
        octx.strokeStyle = this._hatchColor;
        octx.lineWidth = 0.8;
        const step = Math.max(4, cs * 0.3);
        for (let i = -cs; i < cs * 2; i += step) {
          octx.beginPath();
          octx.moveTo(next.c * cs + i, next.r * cs);
          octx.lineTo(next.c * cs + i + cs, next.r * cs + cs);
          octx.stroke();
        }
        octx.restore();
      }

      // ── Update agent position and heading ──
      agent.r = next.r;
      agent.c = next.c;
      agent.dir = next.dir;
    }

    EventBus.emit("ecf:tick", { count: this._agents.length });
  }

  // ── Directed sweep navigation ────────────────────

  /**
   * Determine the next position for an agent using directed-sweep:
   * 1. Try to continue in current direction
   * 2. Try perpendicular directions (realistic deflect/bounce)
   * 3. Try reverse direction
   * 4. Stay put and pick a new random heading for next tick
   *
   * @param {{ r, c, dir }} agent
   * @param {{ r, c }}      frontier — current algorithm frontier (safe-zone centre)
   * @returns {{ r, c, dir }}
   */
  _nextCell(agent, frontier) {
    // 1. Preferred: continue straight
    const straight = this._tryDir(agent, agent.dir, frontier);
    if (straight) return straight;

    // 2. Deflect: perpendiculars (shuffled so there's no directional bias)
    const perps = this._perpendiculars(agent.dir);
    this._shuffle(perps);
    for (const dir of perps) {
      const result = this._tryDir(agent, dir, frontier);
      if (result) return result;
    }

    // 3. Reverse
    const reverse = { r: -agent.dir.r, c: -agent.dir.c };
    const rev = this._tryDir(agent, reverse, frontier);
    if (rev) return rev;

    // 4. Completely blocked — stay put, pick new random heading
    const newDir = this._dirs[Math.floor(Math.random() * this._dirs.length)];
    return { r: agent.r, c: agent.c, dir: newDir };
  }

  /**
   * Check if an agent can move in the given direction.
   * Returns the resulting position+dir object, or null if blocked.
   *
   * Blocked by: boundary, wall (another agent), start, goal,
   *             visited node, or the safe-zone around the frontier.
   */
  _tryDir(agent, dir, frontier) {
    const nr = agent.r + dir.r;
    const nc = agent.c + dir.c;
    const grid = this._grid;

    if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) return null;

    const cell = grid.cell(nr, nc);
    if (!cell) return null;
    if (cell.state === "start" || cell.state === "goal") return null;
    if (cell.state === "wall") return null; // another agent
    if (cell.state === "visited") return null; // keep heatmap intact

    // Enforce safe-zone: must be ≥2 Chebyshev steps from frontier
    const dist = Math.max(Math.abs(nr - frontier.r), Math.abs(nc - frontier.c));
    if (dist < 2) return null;

    return { r: nr, c: nc, dir };
  }

  /**
   * Return directions perpendicular to the given dir.
   * Works for both cardinal and diagonal headings via dot-product filter.
   * A direction is perpendicular when its dot product with dir equals zero.
   */
  _perpendiculars(dir) {
    return this._dirs.filter((d) => d.r * dir.r + d.c * dir.c === 0);
  }

  /** Fisher-Yates in-place shuffle (used to remove directional bias). */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  pause() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}
