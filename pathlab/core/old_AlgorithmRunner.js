/**
 * PathLab — AlgorithmRunner
 * Drives generator-based algorithms step by step,
 * controlling animation speed via setTimeout + requestAnimationFrame.
 *
 * Multiple algorithms can run in parallel — their generators are
 * stepped in round-robin so their visualizations race side-by-side.
 *
 * Step object schema (yielded by every algorithm):
 *   { type: 'visit',   r, c, cost }         — node expanded
 *   { type: 'path',    r, c }               — node on final path
 *   { type: 'done',    success, path,
 *                      nodesExpanded,
 *                      pathCost }           — algorithm finished
 */
import { EventBus } from "./EventBus.js";

export class AlgorithmRunner {
  constructor(grid, renderer) {
    this._grid = grid;
    this._renderer = renderer;

    // Settings (updated by UI before each run)
    this.heuristic = "manhattan";
    this.dirs8 = false;
    this.delay = 18; // ms between animation frames (0 = max speed)
    this.batchSize = 3; // steps per frame at delay > 0

    // Internal state
    this._runners = []; // active RunnerSlot[]
    this._status = "idle"; // 'idle' | 'running' | 'paused' | 'done'
    this._rafId = null;
    this._timerId = null;
    this._results = [];

    // Dynamic obstacle support
    this._dynamicMode = false;
    this._pendingObstacles = []; // queued obstacle changes during a run
  }

  // ── Public API ────────────────────────────────

  get status() {
    return this._status;
  }
  get isRunning() {
    return this._status === "running";
  }
  get isDone() {
    return this._status === "done";
  }

  /**
   * Start an animated run of the selected algorithms.
   * @param {string[]} names           — algorithm names from registry
   * @param {import('../plugins/PluginRegistry.js').PluginRegistry} registry
   */
  run(names, registry) {
    this._cancelTimers();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];
    this._pendingObstacles = [];
    this._ecfStepCounter = 0;

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
          pathBuffer: [], // accumulate path steps
          nodesExpanded: 0,
          result: null,
          computeMs: 0, // accumulated in _processOneStep, excludes animation delay
          agentPos: { r: this._grid.start.r, c: this._grid.start.c },
        };
      })
      .filter(Boolean);

    if (this._runners.length === 0) return;

    this._status = "running";
    EventBus.emit("run:start", { algorithms: names });
    this._scheduleNext();
  }

  /**
   * Prepare for single-step mode without starting the tick loop.
   * @param {string[]} names
   * @param {import('../plugins/PluginRegistry.js').PluginRegistry} registry
   */
  prepareStepMode(names, registry) {
    this._cancelTimers();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];
    this._ecfStepCounter = 0;

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
          computeMs: 0, // accumulated in _processOneStep, excludes animation delay
          agentPos: { r: this._grid.start.r, c: this._grid.start.c },
        };
      })
      .filter(Boolean);

    this._status = "paused";
    EventBus.emit("run:start", { algorithms: names });
  }

  /**
   * Advance all algorithms exactly one step each.
   */
  stepOnce() {
    if (this._runners.length === 0) return;
    for (const slot of this._runners) {
      if (slot.done) continue;
      this._processOneStep(slot);
    }
    this._checkAllDone();
  }

  /** Pause an in-progress run. */
  pause() {
    if (this._status !== "running") return;
    this._cancelTimers();
    this._status = "paused";
  }

  /** Resume a paused run. */
  resume() {
    if (this._status !== "paused") return;
    this._status = "running";
    this._scheduleNext();
  }

  /** Stop the run and idle. */
  stop() {
    this._cancelTimers();
    this._status = "idle";
    this._runners = [];
  }

  /**
   * Reset: stop run, clear visualization.
   * Grid walls are preserved.
   */
  reset() {
    this.stop();
    this._grid.clearVisualization();
    this._renderer.clearDynamic();
    this._results = [];
    EventBus.emit("run:reset", {});
  }

  /**
   * Notify runner that an obstacle was added during a dynamic run.
   * @param {number} r
   * @param {number} c
   */
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

  // ── Internal tick loop ─────────────────────────

  _scheduleNext() {
    if (this._status !== "running") return;

    if (this.delay <= 0) {
      // Max speed: step in large batches each animation frame
      this._rafId = requestAnimationFrame(() => this._tickFast());
    } else {
      this._timerId = setTimeout(() => {
        this._rafId = requestAnimationFrame(() => this._tickNormal());
      }, this.delay);
    }
  }

  _tickNormal() {
    if (this._status !== "running") return;

    // Process a small batch per frame
    for (let i = 0; i < this.batchSize; i++) {
      let anyActive = false;
      for (const slot of this._runners) {
        if (slot.done) continue;
        anyActive = true;
        this._processOneStep(slot);
      }
      if (!anyActive) break;
    }

    if (!this._checkAllDone()) {
      this._scheduleNext();
    }
  }

  _tickFast() {
    if (this._status !== "running") return;

    // Large batch for near-instant visualization
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

    if (!this._checkAllDone()) {
      this._scheduleNext();
    }
  }

  // ── Step processing ────────────────────────────

  /**
   * Pull one step from a runner's generator and act on it.
   * @param {Object} slot
   */
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
        // Track agent's frontier position for ECF safe-zone
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
          replanCount: step.replanCount ?? 0, // ADD
          replanNodes: step.replanNodes ?? 0, // ADD
        };
        if (slot.result.success && slot.result.path.length > 1) {
          this._renderer.drawPath(slot.result.path, slot.color);
        }
        this._results.push(slot.result);
        EventBus.emit("run:result", slot.result);
        break;
    }
  }

  /**
   * Check whether all runners are done; if so, emit run:done.
   * @returns {boolean} true if all done
   */
  _checkAllDone() {
    if (this._runners.length === 0) return false;
    if (!this._runners.every((s) => s.done)) return false;

    this._status = "done";
    this._cancelTimers();

    // 1. Collect all memory metrics into a clean array
    const memoryArray = this._results.map((r) => r.memoryBytes);

    // 2. Emit the results including the collected memory array
    EventBus.emit("run:done", {
      results: this._results,
      memorySummary: memoryArray, // New field for your dashboard
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
