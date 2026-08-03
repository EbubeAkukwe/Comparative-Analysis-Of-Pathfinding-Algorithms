/**
 * PathLab — AlgorithmRunner
 *
 * Two modes:
 *
 * 1. NORMAL MODE  — run(names, registry)
 *    Drives algorithm generators step-by-step with animation.
 *    No replanning. Used when ECF is off.
 *
 * 2. SIMULATION MODE — runSimulation(names, registry)
 *    Real-world model: agent physically moves along the found path,
 *    one cell per tick. ECF obstacles move independently in the
 *    background (handled by ECFEngine). If an obstacle appears on
 *    the agent's remaining planned path, each algorithm replans:
 *
 *      • BFS / Dijkstra / A* / Greedy BFS — full replan from
 *        agent's current position (complete replanning).
 *      • D* Lite — incremental replan: only affected edges are
 *        updated; much cheaper than full restart.
 *
 *    Replan count and extra nodes are tracked and emitted to
 *    the dashboard.
 *
 * Step object schema (yielded by every algorithm generator):
 *   { type: 'visit', r, c, cost }
 *   { type: 'path',  r, c }
 *   { type: 'done',  success, path, nodesExpanded, pathCost,
 *                    peakMemoryBytes?, replanCount?, replanNodes? }
 */
import { EventBus } from "./EventBus.js";

export class AlgorithmRunner {
  constructor(grid, renderer) {
    this._grid = grid;
    this._renderer = renderer;

    // Settings
    this.heuristic = "manhattan";
    this.dirs8 = false;
    this.delay = 18;
    this.batchSize = 3;

    // Core state
    this._runners = [];
    this._status = "idle";
    this._rafId = null;
    this._timerId = null;
    this._results = [];

    // Legacy dynamic mode (manual obstacle painting)
    this._dynamicMode = false;
    this._pendingObstacles = [];

    // ── Simulation mode state ──────────────────────
    this._simMode = false;
    this._simNames = [];
    this._simRegistry = null;

    // Per-slot simulation state (keyed by algo name)
    // Each entry: { agentPos, remainingPath, replanCount,
    //               totalNodes, replanNodes, computeMs,
    //               done, result, color, name }
    this._simSlots = [];

    // Agent movement timer (separate from search animation timer)
    this._agentTimerId = null;
  }

  // ── Public API ─────────────────────────────────

  get status() {
    return this._status;
  }
  get isRunning() {
    return this._status === "running";
  }
  get isDone() {
    return this._status === "done";
  }

  // ── NORMAL MODE ────────────────────────────────

  run(names, registry) {
    this._simMode = false;
    this._cancelTimers();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];
    this._pendingObstacles = [];

    this._runners = names
      .map((name) => {
        const info = registry.get(name);
        if (!info) return null;
        const algo = new info.cls(this._grid, this.heuristic, this.dirs8);
        return {
          name,
          color: info.color,
          gen: algo.solve(),
          done: false,
          pathBuffer: [],
          nodesExpanded: 0,
          result: null,
          computeMs: 0,
          agentPos: { r: this._grid.start.r, c: this._grid.start.c },
        };
      })
      .filter(Boolean);

    if (!this._runners.length) return;
    this._status = "running";
    EventBus.emit("run:start", { algorithms: names });
    this._scheduleNext();
  }

  prepareStepMode(names, registry) {
    this._simMode = false;
    this._cancelTimers();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];

    this._runners = names
      .map((name) => {
        const info = registry.get(name);
        if (!info) return null;
        const algo = new info.cls(this._grid, this.heuristic, this.dirs8);
        return {
          name,
          color: info.color,
          gen: algo.solve(),
          done: false,
          pathBuffer: [],
          nodesExpanded: 0,
          result: null,
          computeMs: 0,
          agentPos: { r: this._grid.start.r, c: this._grid.start.c },
        };
      })
      .filter(Boolean);

    this._status = "paused";
    EventBus.emit("run:start", { algorithms: names });
  }

  stepOnce() {
    if (!this._runners.length) return;
    for (const slot of this._runners) {
      if (slot.done) continue;
      this._processOneStep(slot);
    }
    this._checkAllDone();
  }

  // ── SIMULATION MODE ────────────────────────────

  /**
   * Start real-world simulation.
   * Each algorithm gets its own agent that physically walks the path.
   * ECFEngine runs independently and calls onObstaclePlaced() when
   * a wall is placed, triggering replanning.
   *
   * @param {string[]} names
   * @param {import('../plugins/PluginRegistry.js').PluginRegistry} registry
   */
  runSimulation(names, registry) {
    this._simMode = true;
    this._simNames = names;
    this._simRegistry = registry;

    this._cancelTimers();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];
    this._simSlots = [];

    // Build a sim-slot for each algorithm
    for (const name of names) {
      const info = registry.get(name);
      if (!info) continue;
      this._simSlots.push({
        name,
        color: info.color,
        agentPos: { r: this._grid.start.r, c: this._grid.start.c },
        remainingPath: [], // cells yet to walk
        replanCount: 0,
        totalNodes: 0,
        replanNodes: 0,
        computeMs: 0,
        done: false,
        success: false,
        result: null,
        // search generator state (null when not currently searching)
        searchGen: null,
        searching: true, // true = running search, false = walking path
      });
    }

    if (!this._simSlots.length) return;

    this._status = "running";
    EventBus.emit("run:start", { algorithms: names });

    // Kick off initial search for all slots
    for (const slot of this._simSlots) {
      this._startSearch(slot, slot.agentPos);
    }

    this._scheduleSimTick();
  }

  /**
   * Called by ECFEngine (via main.js) whenever an obstacle is placed.
   * For each algorithm: if the new wall is on their remaining path,
   * trigger a replan from current position.
   * @param {number} r
   * @param {number} c
   */
  onObstaclePlaced(r, c) {
    if (!this._simMode || this._status !== "running") return;

    for (const slot of this._simSlots) {
      if (slot.done) continue;

      // Check if obstacle falls on remaining planned path
      const blocked = slot.remainingPath.some((p) => p.r === r && p.c === c);
      if (!blocked) continue;

      // Obstacle is on the path — replan from current position
      slot.replanCount++;
      slot.remainingPath = []; // discard stale path
      slot.searching = true;

      // Emit replan event for dashboard
      EventBus.emit("run:replan", {
        name: slot.name,
        replanCount: slot.replanCount,
        fromPos: { ...slot.agentPos },
      });

      this._startSearch(slot, slot.agentPos);
    }
  }

  // ── Simulation internals ───────────────────────

  /**
   * Build a fresh search generator for a slot, starting from fromPos.
   * Temporarily shifts grid.start to fromPos so the algorithm
   * searches from the agent's current location.
   */
  _startSearch(slot, fromPos) {
    const grid = this._grid;
    const info = this._simRegistry.get(slot.name);
    if (!info) return;

    // Temporarily move start to agent's current position
    const origStart = { ...grid.start };
    const origStartState = grid.cell(fromPos.r, fromPos.c)?.state;

    // Only move if fromPos isn't already start/goal
    if (origStartState !== "goal") {
      if (origStart.r !== fromPos.r || origStart.c !== fromPos.c) {
        grid.cell(origStart.r, origStart.c).state = "open";
      }
      grid.start = { ...fromPos };
      if (grid.cell(fromPos.r, fromPos.c)?.state === "open") {
        grid.cell(fromPos.r, fromPos.c).state = "start";
      }
    }

    const algo = new info.cls(grid, this.heuristic, this.dirs8);
    slot.searchGen = algo.solve();
    slot.searching = true;
    slot.pathBuffer = [];

    // Restore original start position in grid data
    if (origStart.r !== fromPos.r || origStart.c !== fromPos.c) {
      if (grid.cell(fromPos.r, fromPos.c)?.state === "start") {
        grid.cell(fromPos.r, fromPos.c).state = "open";
      }
      grid.start = origStart;
      grid.cell(origStart.r, origStart.c).state = "start";
    }
  }

  /**
   * Schedule the simulation tick — drives both the search animation
   * and agent movement in a single unified loop.
   */
  _scheduleSimTick() {
    if (this._status !== "running") return;
    if (this.delay <= 0) {
      this._rafId = requestAnimationFrame(() => this._simTickFast());
    } else {
      this._timerId = setTimeout(() => {
        this._rafId = requestAnimationFrame(() => this._simTickNormal());
      }, this.delay);
    }
  }

  _simTickNormal() {
    if (this._status !== "running") return;

    for (let i = 0; i < this.batchSize; i++) {
      this._simStep();
    }

    if (!this._checkSimDone()) {
      this._scheduleSimTick();
    }
  }

  _simTickFast() {
    if (this._status !== "running") return;

    for (let i = 0; i < 20; i++) {
      this._simStep();
    }

    if (!this._checkSimDone()) {
      this._scheduleSimTick();
    }
  }

  /**
   * One simulation micro-step across all slots.
   * If a slot is searching  → advance its search generator one step.
   * If a slot is walking    → move agent one cell along remaining path.
   */
  _simStep() {
    for (const slot of this._simSlots) {
      if (slot.done) continue;

      if (slot.searching) {
        this._simSearchStep(slot);
      } else {
        this._simWalkStep(slot);
      }
    }
  }

  /**
   * Advance the search generator one step for a slot.
   * When search completes, switch slot to walking mode.
   */
  _simSearchStep(slot) {
    if (!slot.searchGen) return;

    const t0 = performance.now();
    const { value: step, done: genDone } = slot.searchGen.next();
    slot.computeMs += performance.now() - t0;

    if (genDone || !step) {
      // Generator exhausted without 'done' step — treat as failure
      slot.done = true;
      slot.success = false;
      this._finaliseSimSlot(slot, [], Infinity);
      return;
    }

    switch (step.type) {
      case "visit":
        slot.totalNodes++;
        if (slot.replanCount > 0) slot.replanNodes++;
        slot.agentPos = { r: step.r, c: step.c };
        // Draw visited node — use a slightly transparent version
        // so heatmap doesn't get fully overwritten on replan
        this._renderer.drawVisit(step.r, step.c, slot.color);
        EventBus.emit("run:step", { name: slot.name, step });
        break;

      case "path":
        // Accumulate path steps as search yields them
        if (!slot.pathBuffer) slot.pathBuffer = [];
        slot.pathBuffer.push({ r: step.r, c: step.c });
        break;

      case "done":
        slot.searchGen = null;

        if (!step.success) {
          // No path found — algorithm is stuck
          slot.done = true;
          slot.success = false;
          this._finaliseSimSlot(slot, [], Infinity);
          EventBus.emit("run:replan", {
            name: slot.name,
            blocked: true,
            message: "No path found — goal unreachable",
          });
          return;
        }

        // Path found — store it and switch to walking mode
        const path = step.path ?? slot.pathBuffer ?? [];

        // Skip cells already at or behind agent (path[0] = current pos)
        const startIdx = path.findIndex(
          (p) => p.r === slot.agentPos.r && p.c === slot.agentPos.c,
        );
        slot.remainingPath =
          startIdx >= 0 ? path.slice(startIdx + 1) : path.slice(1);

        slot.searching = false;
        slot.pathBuffer = [];

        // Draw the planned path (faint, will be walked over)
        this._renderer.drawPath(path, slot.color + "66");
        break;
    }
  }

  /**
   * Move agent one step along its remaining path.
   * Checks if next cell is still open before stepping.
   */
  _simWalkStep(slot) {
    if (!slot.remainingPath.length) {
      // Path exhausted — agent may have reached goal or got stuck
      const cur = slot.agentPos;
      if (cur.r === this._grid.goal.r && cur.c === this._grid.goal.c) {
        slot.done = true;
        slot.success = true;
        this._finaliseSimSlot(slot, [], 0);
      } else {
        // Somehow path ran out before goal — replan
        slot.searching = true;
        slot.remainingPath = [];
        slot.replanCount++;
        this._startSearch(slot, slot.agentPos);
      }
      return;
    }

    const next = slot.remainingPath[0];
    const nextCell = this._grid.cell(next.r, next.c);

    if (!nextCell || nextCell.state === "wall") {
      // Next step is blocked — replan immediately
      slot.searching = true;
      slot.remainingPath = [];
      slot.replanCount++;

      EventBus.emit("run:replan", {
        name: slot.name,
        replanCount: slot.replanCount,
        fromPos: { ...slot.agentPos },
      });

      this._startSearch(slot, slot.agentPos);
      return;
    }

    // Step is clear — move agent
    slot.remainingPath.shift();
    slot.agentPos = { r: next.r, c: next.c };

    // Draw agent marker on dynamic canvas
    this._drawAgentMarker(next.r, next.c, slot.color);

    // Emit so ECFEngine safe-zone stays current
    EventBus.emit("run:step", {
      name: slot.name,
      step: { type: "visit", r: next.r, c: next.c },
    });

    // Check if goal reached
    if (next.r === this._grid.goal.r && next.c === this._grid.goal.c) {
      slot.done = true;
      slot.success = true;
      this._finaliseSimSlot(slot, [], 0);
    }
  }

  /**
   * Draw a distinct agent marker so you can see each agent's
   * current position as it walks.
   */
  _drawAgentMarker(r, c, color) {
    const ctx = this._renderer._dctx;
    const cs = this._renderer.cellSize;
    const cx = c * cs + cs / 2;
    const cy = r * cs + cs / 2;
    const rad = Math.max(3, cs * 0.32);

    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /**
   * Finalise a sim slot and emit run:result.
   */
  _finaliseSimSlot(slot, path, pathCost) {
    slot.result = {
      name: slot.name,
      success: slot.success,
      path: path,
      nodesExpanded: slot.totalNodes,
      pathCost: pathCost,
      pathLength: path.length,
      runtime_ms: slot.computeMs,
      memoryBytes: 0,
      replanCount: slot.replanCount,
      replanNodes: slot.replanNodes,
    };
    this._results.push(slot.result);
    EventBus.emit("run:result", slot.result);
  }

  /**
   * Check if all simulation slots are done.
   */
  _checkSimDone() {
    if (!this._simSlots.length) return false;
    if (!this._simSlots.every((s) => s.done)) return false;

    this._status = "done";
    this._cancelTimers();
    EventBus.emit("run:done", {
      results: this._results,
      memorySummary: this._results.map((r) => r.memoryBytes),
    });
    return true;
  }

  // ── Shared controls ────────────────────────────

  pause() {
    if (this._status !== "running") return;
    this._cancelTimers();
    this._status = "paused";
  }

  resume() {
    if (this._status !== "paused") return;
    this._status = "running";
    if (this._simMode) {
      this._scheduleSimTick();
    } else {
      this._scheduleNext();
    }
  }

  stop() {
    this._cancelTimers();
    this._status = "idle";
    this._runners = [];
    this._simSlots = [];
    this._simMode = false;
  }

  reset() {
    this.stop();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];
    EventBus.emit("run:reset", {});
  }

  notifyObstacle(r, c) {
    if (!this._dynamicMode || this._status !== "running") return;
    this._pendingObstacles.push({ r, c });
  }

  set dynamicMode(v) {
    this._dynamicMode = v;
  }
  get dynamicMode() {
    return this._dynamicMode;
  }

  // ── Normal mode internals ──────────────────────

  _scheduleNext() {
    if (this._status !== "running") return;
    if (this.delay <= 0) {
      this._rafId = requestAnimationFrame(() => this._tickFast());
    } else {
      this._timerId = setTimeout(() => {
        this._rafId = requestAnimationFrame(() => this._tickNormal());
      }, this.delay);
    }
  }

  _tickNormal() {
    if (this._status !== "running") return;
    for (let i = 0; i < this.batchSize; i++) {
      let anyActive = false;
      for (const slot of this._runners) {
        if (slot.done) continue;
        anyActive = true;
        this._processOneStep(slot);
      }
      if (!anyActive) break;
    }
    if (!this._checkAllDone()) this._scheduleNext();
  }

  _tickFast() {
    if (this._status !== "running") return;
    const BATCH = 50;
    for (let i = 0; i < BATCH; i++) {
      let anyActive = false;
      for (const slot of this._runners) {
        if (slot.done) continue;
        anyActive = true;
        this._processOneStep(slot);
      }
      if (!anyActive) break;
    }
    if (!this._checkAllDone()) this._scheduleNext();
  }

  _processOneStep(slot) {
    const t0 = performance.now();
    const { value: step, done: genDone } = slot.gen.next();
    slot.computeMs += performance.now() - t0;

    if (genDone || !step) {
      slot.done = true;
      return;
    }

    switch (step.type) {
      case "visit":
        slot.nodesExpanded++;
        slot.agentPos = { r: step.r, c: step.c };
        this._renderer.drawVisit(step.r, step.c, slot.color);
        EventBus.emit("run:step", { name: slot.name, step });
        break;
      case "path":
        slot.pathBuffer.push({ r: step.r, c: step.c });
        break;
      case "done":
        slot.done = true;
        slot.result = {
          name: slot.name,
          success: step.success,
          path: step.path ?? [],
          nodesExpanded: step.nodesExpanded ?? slot.nodesExpanded,
          pathCost: step.pathCost ?? Infinity,
          pathLength: (step.path ?? []).length,
          runtime_ms: slot.computeMs,
          memoryBytes: step.peakMemoryBytes ?? 0,
          replanCount: step.replanCount ?? 0,
          replanNodes: step.replanNodes ?? 0,
        };
        if (slot.result.success && slot.result.path.length > 1) {
          this._renderer.drawPath(slot.result.path, slot.color);
        }
        this._results.push(slot.result);
        EventBus.emit("run:result", slot.result);
        break;
    }
  }

  _checkAllDone() {
    if (!this._runners.length) return false;
    if (!this._runners.every((s) => s.done)) return false;
    this._status = "done";
    this._cancelTimers();
    EventBus.emit("run:done", {
      results: this._results,
      memorySummary: this._results.map((r) => r.memoryBytes),
    });
    return true;
  }

  _cancelTimers() {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}
