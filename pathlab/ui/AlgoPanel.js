/**
 * PathLab — AlgoPanel
 * Manages the left control panel DOM.
 * Reads from State, mutates via StateManager helpers,
 * and uses EventBus for cross-module coordination.
 */
import { EventBus } from "../core/EventBus.js";
import {
  State,
  setTool,
  setHeuristic,
  setMovement,
  setAnimDelay,
  setShowHeatmap,
  setDynamicMode,
  setScatterDensity,
  setEcf,
  toggleAlgo,
} from "../core/StateManager.js";
import { PluginRegistry } from "../plugins/PluginRegistry.js";

export class AlgoPanel {
  /**
   * @param {HTMLElement} panelEl — #panel-left
   */
  constructor(panelEl) {
    this._el = panelEl;
    this._buildAlgoList();
    this._bindControls();
    this._bindEventBus();
    this._syncAll();
  }

  // ── Build algorithm checklist ──────────────────

  _buildAlgoList() {
    const container = this._el.querySelector("#algo-list");
    if (!container) return;
    container.innerHTML = "";

    for (const [name, info] of PluginRegistry.getAll()) {
      const isSelected = State.selectedAlgos.has(name);
      const item = document.createElement("div");
      item.className = `algo-item${isSelected ? " selected" : ""}`;
      item.dataset.name = name;
      item.setAttribute("role", "checkbox");
      item.setAttribute("aria-checked", String(isSelected));
      item.setAttribute("tabindex", "0");

      item.innerHTML = `
        <div class="algo-checkbox">
          <svg class="algo-check-icon" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <polyline points="1,4 3,6 7,2" stroke="#fff" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="algo-name">${name}</span>
        <span class="algo-swatch" style="background:${info.color}"></span>`;

      const toggle = () => {
        toggleAlgo(name);
        const selected = State.selectedAlgos.has(name);
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-checked", String(selected));
      };

      item.addEventListener("click", toggle);
      item.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        }
      });

      container.appendChild(item);
    }
  }

  // ── Bind DOM controls ──────────────────────────

  _bindControls() {
    const $ = (id) =>
      this._el.querySelector(`#${id}`) ?? document.getElementById(id);

    // Tool buttons
    this._el.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setTool(btn.dataset.tool);
      });
    });

    // Terrain generators
    $("btn-maze")?.addEventListener("click", () =>
      EventBus.emit("terrain:maze", {}),
    );
    $("btn-scatter")?.addEventListener("click", () =>
      EventBus.emit("terrain:scatter", {}),
    );
    $("btn-clear-walls")?.addEventListener("click", () =>
      EventBus.emit("terrain:clearWalls", {}),
    );

    // Grid resize
    $("btn-apply-size")?.addEventListener("click", () => {
      const rows = parseInt($("grid-rows").value ?? State.rows);
      const cols = parseInt($("grid-cols").value ?? State.cols);
      if (rows >= 5 && rows <= 60 && cols >= 5 && cols <= 80) {
        EventBus.emit("grid:resize", { rows, cols });
      }
    });

    // Movement select
    $("sel-movement")?.addEventListener("change", (e) =>
      setMovement(e.target.value),
    );

    // Heuristic select
    $("sel-heuristic")?.addEventListener("change", (e) =>
      setHeuristic(e.target.value),
    );

    // Heatmap toggle
    $("toggle-heatmap")?.addEventListener("change", (e) =>
      setShowHeatmap(e.target.checked),
    );

    // Dynamic mode toggle
    $("toggle-dynamic")?.addEventListener("change", (e) =>
      setDynamicMode(e.target.checked),
    );

    $("sel-ecf")?.addEventListener("change", (e) =>
      setEcf(parseInt(e.target.value)),
    );

    // Scatter wall density select
    $("sel-scatter-density")?.addEventListener("change", (e) =>
      setScatterDensity(parseFloat(e.target.value)),
    );

    // Speed slider: 0→100 maps to 120ms→0ms delay
    const speedSlider = $("speed-slider");
    const speedLabel = $("speed-val");
    speedSlider?.addEventListener("input", (e) => {
      const v = parseInt(e.target.value);
      const delay = Math.round((100 - v) * 1.2);
      setAnimDelay(delay);
      if (speedLabel)
        speedLabel.textContent = delay === 0 ? "max" : `${delay}ms`;
    });

    // Run button
    $("btn-run")?.addEventListener("click", () =>
      EventBus.emit("action:run", {}),
    );

    // Step button
    $("btn-step")?.addEventListener("click", () =>
      EventBus.emit("action:step", {}),
    );

    //Benchmark button
    $("btn-benchmark")?.addEventListener("click", () =>
      EventBus.emit("action:benchmark", {}),
    );

    // Reset visualization
    $("btn-reset-run")?.addEventListener("click", () =>
      EventBus.emit("action:resetRun", {}),
    );

    // Clear all
    $("btn-clear-all")?.addEventListener("click", () =>
      EventBus.emit("action:clearAll", {}),
    );

    // Mobile menu toggle
    document
      .getElementById("btn-menu-mobile")
      ?.addEventListener("click", () => {
        this._el.classList.toggle("mobile-open");
        document.getElementById("mobile-backdrop")?.classList.toggle("visible");
      });
    document
      .getElementById("mobile-backdrop")
      ?.addEventListener("click", () => {
        this._el.classList.remove("mobile-open");
        document.getElementById("mobile-backdrop")?.classList.remove("visible");
      });

    // Guide button
    document.getElementById("btn-guide")?.addEventListener("click", () => {
      EventBus.emit("modal:open", { tab: "researcher-note" });
    });
  }

  // ── EventBus subscriptions ─────────────────────

  _bindEventBus() {
    // Keep tool buttons in sync with state
    EventBus.on("settings:changed", ({ key, value }) => {
      if (key === "tool") this._syncTool(value);
      if (key === "phase") this._syncRunButton(value);
    });

    // Keep run button label correct
    EventBus.on("run:start", () => this._syncRunButton("running"));
    EventBus.on("run:done", () => this._syncRunButton("done"));
    EventBus.on("run:reset", () => this._syncRunButton("idle"));
  }

  // ── Sync helpers ───────────────────────────────

  _syncAll() {
    this._syncTool(State.tool);
    this._syncRunButton(State.phase);

    const $ = (id) => document.getElementById(id);
    const mv = $("sel-movement");
    if (mv) mv.value = State.movement;

    const h = $("sel-heuristic");
    if (h) h.value = State.heuristic;

    const heat = $("toggle-heatmap");
    if (heat) heat.checked = State.showHeatmap;

    const dyn = $("toggle-dynamic");
    if (dyn) dyn.checked = State.dynamicMode;

    const sd = $("sel-scatter-density");
    if (sd) sd.value = String(State.scatterDensity);

    const rows = $("grid-rows");
    if (rows) rows.value = String(State.rows);

    const cols = $("grid-cols");
    if (cols) cols.value = String(State.cols);

    // Init speed display
    const speedLabel = $("speed-val");
    const speedSlider = $("speed-slider");
    if (speedLabel && speedSlider) {
      const initial = parseInt(speedSlider.value);
      const delay = Math.round((100 - initial) * 1.2);
      speedLabel.textContent = delay === 0 ? "max" : `${delay}ms`;
      setAnimDelay(delay);
    }
  }

  _syncTool(tool) {
    this._el.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
    });
    const $ = (id) => document.getElementById(id);
    const stTool = $("st-tool");
    if (stTool) stTool.textContent = tool;
  }

  _syncRunButton(phase) {
    const btn = document.getElementById("btn-run");
    if (!btn) return;
    switch (phase) {
      case "running":
        btn.textContent = "⏸  Pause";
        btn.disabled = false;
        break;
      case "paused":
        btn.textContent = "▶  Resume";
        btn.disabled = false;
        break;
      case "done":
        btn.textContent = "▶  Run again";
        btn.disabled = false;
        break;
      default:
        btn.textContent = "▶  Run selected";
        btn.disabled = false;
    }
  }
}
