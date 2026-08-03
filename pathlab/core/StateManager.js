/**
 * PathLab — StateManager
 * Central, single-source-of-truth application state.
 * All mutations go through this module; UI components
 * read from state and subscribe to EventBus for changes.
 */
import { EventBus } from "./EventBus.js";

export const State = {
  // ── Grid settings ──────────────────────────────
  rows: 25,
  cols: 40,
  cellSize: 20,

  // ── Run settings ───────────────────────────────
  /** @type {'manhattan'|'euclidean'|'chebyshev'} */
  heuristic: "manhattan",
  /** @type {'4'|'8'} */
  movement: "4",
  /** Animation delay in ms (0 = max speed) */
  animDelay: 18,

  // ── UI settings ────────────────────────────────
  showHeatmap: true,
  dynamicMode: false,

  ecf: 0, // 0 = off, otherwise 5/10/15/20/30 (percentage)

  /** Scatter terrain wall density, 0–1 */
  scatterDensity: 0.3,

  // ── Active tool ────────────────────────────────
  /** @type {'wall'|'erase'|'start'|'goal'} */
  tool: "wall",

  // ── Selected algorithms ─────────────────────── */
  /** @type {Set<string>} */
  selectedAlgos: new Set(["BFS", "A*"]),

  // ── Run phase ──────────────────────────────────
  /** @type {'idle'|'running'|'paused'|'done'} */
  phase: "idle",

  // ── Last benchmark results ─────────────────────
  /** @type {Map<string, import('./BenchmarkEngine.js').BenchmarkResult>} */
  lastResults: new Map(),

  // ── Cursor position ────────────────────────────
  cursorR: -1,
  cursorC: -1,
};

// ── Mutation helpers ──────────────────────────────

export function setTool(tool) {
  State.tool = tool;
  EventBus.emit("settings:changed", { key: "tool", value: tool });
}

export function setHeuristic(h) {
  State.heuristic = h;
  EventBus.emit("settings:changed", { key: "heuristic", value: h });
}

export function setMovement(m) {
  State.movement = m;
  EventBus.emit("settings:changed", { key: "movement", value: m });
}

export function setAnimDelay(d) {
  State.animDelay = d;
  EventBus.emit("settings:changed", { key: "animDelay", value: d });
}

export function setShowHeatmap(v) {
  State.showHeatmap = v;
  EventBus.emit("settings:changed", { key: "showHeatmap", value: v });
}

export function setDynamicMode(v) {
  State.dynamicMode = v;
  EventBus.emit("settings:changed", { key: "dynamicMode", value: v });
}

export function setScatterDensity(d) {
  State.scatterDensity = d;
  EventBus.emit("settings:changed", { key: "scatterDensity", value: d });
}

export function toggleAlgo(name) {
  if (State.selectedAlgos.has(name)) {
    State.selectedAlgos.delete(name);
  } else {
    State.selectedAlgos.add(name);
  }
  EventBus.emit("algo:selected", {
    name,
    selected: State.selectedAlgos.has(name),
  });
}

export function setPhase(phase) {
  State.phase = phase;
  EventBus.emit("settings:changed", { key: "phase", value: phase });
}

export function recordResult(result) {
  State.lastResults.set(result.name, result);
}

export function clearResults() {
  State.lastResults.clear();
}

export function setCursor(r, c) {
  State.cursorR = r;
  State.cursorC = c;
}

export function setEcf(v) {
  State.ecf = v;
  EventBus.emit("settings:changed", { key: "ecf", value: v });
}
