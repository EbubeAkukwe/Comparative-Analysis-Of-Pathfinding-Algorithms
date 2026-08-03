/**
 * PathLab — Main Application Entry Point
 *
 * Wires all modules together:
 *   Grid → Renderer → AlgorithmRunner → GridController
 *   AlgoPanel, Dashboard, EducationalModal, StatusBar, Header, RunLog
 *
 * All cross-module coordination is via EventBus.
 * This file only contains bootstrap and top-level event dispatch.
 */

import { EventBus } from "./core/EventBus.js";
import { Grid } from "./core/Grid.js";
import { Renderer } from "./core/Renderer.js";
import { AlgorithmRunner } from "./core/AlgorithmRunner.js";
import { BenchmarkEngine } from "./core/BenchmarkEngine.js";
import { ECFEngine } from "./core/ECFEngine.js";
//import { DynamicObstacleEngine } from "./core/DynamicObstacleEngine.js";
import { State, setPhase } from "./core/StateManager.js";

import { PluginRegistry } from "./plugins/PluginRegistry.js";

import { AlgoPanel } from "./ui/AlgoPanel.js";
import { GridController } from "./ui/GridController.js";
import { Dashboard } from "./ui/Dashboard.js";
import { EducationalModal } from "./ui/EducationalModal.js";
import { StatusBar } from "./ui/StatusBar.js";
import { Header } from "./ui/StatusBar.js";
import { RunLog } from "./ui/RunLog.js";

// ══════════════════════════════════════════════════
// 1. Core objects
// ══════════════════════════════════════════════════

const grid = new Grid(State.rows, State.cols);
const renderer = new Renderer(
  document.getElementById("canvas-static"),
  document.getElementById("canvas-dynamic"),
  document.getElementById("canvas-overlay"),
);
const runner = new AlgorithmRunner(grid, renderer);
const benchmark = new BenchmarkEngine(grid);
const ecfEngine = new ECFEngine(grid, renderer);
//const dynObstacles = new DynamicObstacleEngine(grid, renderer);

// ══════════════════════════════════════════════════
// 2. Initial render
// ══════════════════════════════════════════════════

function calcAndResize() {
  const wrap = document.getElementById("canvas-wrap");
  const availW = wrap.clientWidth - 32;
  const availH = wrap.clientHeight - 32;
  const cs = Renderer.calcCellSize(grid.rows, grid.cols, availW, availH);
  renderer.resize(grid.rows, grid.cols, cs);
  renderer.drawGrid(grid);
  State.cellSize = cs;
  document.getElementById("st-grid").textContent = `${grid.rows}×${grid.cols}`;
  document.getElementById("header-grid-info").textContent =
    `${grid.rows}×${grid.cols}`;
}

calcAndResize();

// ══════════════════════════════════════════════════
// 3. UI modules
// ══════════════════════════════════════════════════

const algoPanel = new AlgoPanel(document.getElementById("panel-left"));
const controller = new GridController(
  grid,
  renderer,
  document.getElementById("canvas-overlay"),
  runner,
);
const dashboard = new Dashboard(document.getElementById("panel-right"));
const modal = new EducationalModal();
const statusBar = new StatusBar();
const header = new Header();
const log = new RunLog(document.getElementById("run-log"));

// ══════════════════════════════════════════════════
// 4. EventBus action handlers
// ══════════════════════════════════════════════════

// ── Run / Pause / Resume ───────────────────────

EventBus.on("action:run", () => {
  if (!State.selectedAlgos.size) {
    log.warn("Select at least one algorithm first.");
    return;
  }

  if (runner.status === "running") {
    runner.pause();
    setPhase("paused");
    return;
  }

  if (runner.status === "paused") {
    runner.resume();
    setPhase("running");
    return;
  }

  // Fresh run
  runner.heuristic = State.heuristic;
  runner.dirs8 = State.movement === "8";
  runner.delay = State.animDelay;
  runner.dynamicMode = State.dynamicMode;

  setPhase("running");

  runner.run(Array.from(State.selectedAlgos), PluginRegistry); // ← run() called AFTER
});

// ── Step mode ──────────────────────────────────

EventBus.on("action:step", () => {
  if (!State.selectedAlgos.size) {
    log.warn("Select at least one algorithm first.");
    return;
  }

  if (runner.status === "idle" || runner.status === "done") {
    runner.heuristic = State.heuristic;
    runner.dirs8 = State.movement === "8";
    runner.dynamicMode = State.dynamicMode;
    runner.prepareStepMode(Array.from(State.selectedAlgos), PluginRegistry);
    log.info('Step mode — click "Step once" to advance one node at a time.');
  }

  runner.stepOnce();
});

// –– Quick Benchmark –––––––––––––––––––––––––––––

EventBus.on("action:benchmark", () => {
  if (!State.selectedAlgos.size) {
    log.warn("Select at least one algorithm first.");
    return;
  }

  runner.stop(); // cancel any in-progress animated run
  grid.clearVisualization();
  renderer.clearDynamic();

  benchmark.clearResults();
  const results = benchmark.runAll(
    Array.from(State.selectedAlgos),
    PluginRegistry,
    State.heuristic,
    State.movement === "8",
  );

  // Draw the path of each successful result onto the canvas, no animation
  for (const result of results) {
    const info = PluginRegistry.get(result.name);
    if (result.success && result.path.length > 1) {
      renderer.drawPath(result.path, info?.color ?? "#888");
    }
    EventBus.emit("run:result", result); // dashboard updates exactly like a normal run
  }

  setPhase("done");
  EventBus.emit("run:done", { results });
  log.success(
    `Benchmark complete — ${results.length} algorithms, no animation.`,
  );
});

// ── Reset visualization ─────────────────────────

EventBus.on("action:resetRun", () => {
  runner.reset();
  ecfEngine.stop();
  const ecfSelect = document.getElementById("sel-ecf");
  if (ecfSelect) ecfSelect.value = "0";
  State.ecf = 0;
  setPhase("idle");
});

// ── Clear all ──────────────────────────────────

EventBus.on("action:clearAll", () => {
  runner.stop();
  grid.clearAll();
  calcAndResize();
  benchmark.reset();
  setPhase("idle");
});

// ── Terrain generation ─────────────────────────

EventBus.on("terrain:maze", () => {
  runner.stop();
  grid.generateMaze();
  renderer.clearDynamic();
  renderer.drawGrid(grid);
  setPhase("idle");
});

EventBus.on("terrain:scatter", () => {
  runner.stop();
  grid.scatterWalls(State.scatterDensity);
  renderer.clearDynamic();
  renderer.drawGrid(grid);
  setPhase("idle");
});

EventBus.on("terrain:clearWalls", () => {
  runner.stop();
  grid.clearWalls();
  renderer.clearDynamic();
  renderer.drawGrid(grid);
  setPhase("idle");
});

// ── Grid resize ────────────────────────────────

EventBus.on("grid:resize", ({ rows, cols }) => {
  runner.stop();
  State.rows = rows;
  State.cols = cols;
  grid.resize(rows, cols);
  calcAndResize();
  benchmark.reset();
  setPhase("idle");
  controller.refresh();
  EventBus.emit("grid:resized", { rows, cols });
});

// ── Settings changes → propagate to runner ──────

EventBus.on("settings:changed", ({ key, value }) => {
  if (key === "heuristic") runner.heuristic = value;
  if (key === "movement") runner.dirs8 = value === "8";
  if (key === "animDelay") {
    runner.delay = value;
    //dynObstacles.delay = value; // keep speeds in sync
  }
  if (key === "showHeatmap") renderer.showHeatmap = value;
  if (key === "dynamicMode") {
    runner.dynamicMode = value;
    /*if (value) {
      // If no walls exist yet, scatter some first
      if (grid.count("wall") === 0) {
        grid.scatterWalls(State.scatterDensity);
        renderer.drawGrid(grid);
      }
      dynObstacles.delay = State.animDelay;
      dynObstacles.start();
    } else {
      dynObstacles.stop();
    }*/
  }
  if (key === "ecf") {
    if (value > 0) {
      const intervalMs = Math.round(2000 / value);
      ecfEngine.start(value, intervalMs, State.movement === "8");
    } else {
      ecfEngine.stop();
    }
  }

  if (key === "movement" && ecfEngine.isRunning) {
    const intervalMs = Math.round(2000 / State.ecf);
    ecfEngine.start(State.ecf, intervalMs, value === "8");
  }
});

// ── Run lifecycle → phase sync ──────────────────

EventBus.on("run:done", () => {
  setPhase("done");
  ecfEngine.pause();
  const ecfSelect = document.getElementById("sel-ecf");
  if (ecfSelect) ecfSelect.value = "0";
  State.ecf = 0;
});

EventBus.on("run:reset", () => setPhase("idle"));

// ── Cell changes → redraw static layer ─────────

EventBus.on("grid:changed", ({ r, c }) => {
  renderer.drawCell(grid, r, c);
});

// ══════════════════════════════════════════════════
// 5. Keyboard shortcuts
// ══════════════════════════════════════════════════

document.addEventListener("keydown", (e) => {
  // Don't fire shortcuts when typing in an input
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  // Don't fire when modal is open
  if (document.getElementById("modal-backdrop")?.classList.contains("open"))
    return;

  switch (e.key) {
    case "r":
    case "R":
      EventBus.emit("action:run", {});
      break;
    case " ":
      e.preventDefault();
      EventBus.emit("action:step", {});
      break;
    case "Escape":
      EventBus.emit("action:resetRun", {});
      break;
    case "w":
    case "W":
      import("./core/StateManager.js").then((m) => m.setTool("wall"));
      break;
    case "e":
    case "E":
      import("./core/StateManager.js").then((m) => m.setTool("erase"));
      break;
    case "s":
    case "S":
      import("./core/StateManager.js").then((m) => m.setTool("start"));
      break;
    case "g":
    case "G":
      import("./core/StateManager.js").then((m) => m.setTool("goal"));
      break;
    case "m":
    case "M":
      EventBus.emit("terrain:maze", {});
      break;
    case "?":
      EventBus.emit("modal:open", { tab: "algorithms" });
      break;
    case "Delete":
    case "Backspace":
      if (e.shiftKey) EventBus.emit("action:clearAll", {});
      break;
  }
});

// ══════════════════════════════════════════════════
// 6. Window resize
// ══════════════════════════════════════════════════

let _resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    calcAndResize();
    controller.refresh();
  }, 120);
});

// ══════════════════════════════════════════════════
// 7. Ready
// ══════════════════════════════════════════════════

log.info(
  `${PluginRegistry.names().length} algorithms registered. Grid: ${grid.rows}×${grid.cols}.`,
);
log.plain("Tip: pick algorithms, set heuristic, then ▶ Run selected.");
