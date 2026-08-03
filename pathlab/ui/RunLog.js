/**
 * PathLab — RunLog
 * Live log strip at the bottom of the canvas viewport.
 * Subscribes to EventBus and appends timestamped lines.
 */
import { EventBus } from "../core/EventBus.js";
import { PluginRegistry } from "../plugins/PluginRegistry.js";

export class RunLog {
  /**
   * @param {HTMLElement} el — #run-log
   */
  constructor(el) {
    this._el = el;
    this._startTime = Date.now();
    this._maxLines = 120;
    this._bindEvents();
    this.info("PathLab ready — place S, G, walls, then Run selected.");
  }

  // ── Public write methods ───────────────────────

  write(msg, cls = "") {
    const elapsed = ((Date.now() - this._startTime) / 1000)
      .toFixed(1)
      .padStart(6, "0");
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `<span class="log-ts">${elapsed}s</span><span class="log-msg ${cls}">${this._escHtml(msg)}</span>`;
    this._el.appendChild(line);
    this._el.scrollTop = this._el.scrollHeight;

    // Trim old lines
    while (this._el.children.length > this._maxLines) {
      this._el.removeChild(this._el.firstChild);
    }
  }

  info(msg) {
    this.write(msg, "info");
  }
  success(msg) {
    this.write(msg, "success");
  }
  warn(msg) {
    this.write(msg, "warn");
  }
  error(msg) {
    this.write(msg, "error");
  }
  plain(msg) {
    this.write(msg, "");
  }

  clear() {
    this._el.innerHTML = "";
  }

  // ── EventBus subscriptions ─────────────────────

  _bindEvents() {
    EventBus.on("run:start", ({ algorithms }) => {
      const heuristic = document.getElementById("sel-heuristic")?.value ?? "—";
      const movement = document.getElementById("sel-movement")?.value ?? "4";
      this.info(
        `▶ Starting: ${algorithms.join(", ")} · ${heuristic} · ${movement}-dir`,
      );
    });

    EventBus.on("run:result", (result) => {
      const info = PluginRegistry.get(result.name);
      const swatch = info?.color
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${info.color};margin-right:4px;vertical-align:middle"></span>`
        : "";

      if (result.success) {
        const rt =
          result.runtime_ms != null
            ? ` · ${result.runtime_ms.toFixed(3)}ms`
            : "";
        const cost = isFinite(result.pathCost)
          ? ` · cost ${result.pathCost.toFixed(2)}`
          : "";
        const line = document.createElement("div");
        line.className = "log-line";
        line.innerHTML =
          `<span class="log-ts">${((Date.now() - this._startTime) / 1000).toFixed(1).padStart(6, "0")}s</span>` +
          `<span class="log-msg success">${swatch}${this._escHtml(result.name)}: ` +
          `${result.nodesExpanded} nodes${rt}${cost}</span>`;
        this._el.appendChild(line);
        this._el.scrollTop = this._el.scrollHeight;
      } else {
        const line = document.createElement("div");
        line.className = "log-line";
        line.innerHTML =
          `<span class="log-ts">${((Date.now() - this._startTime) / 1000).toFixed(1).padStart(6, "0")}s</span>` +
          `<span class="log-msg error">${swatch}${this._escHtml(result.name)}: no path found ` +
          `(${result.nodesExpanded} nodes expanded)</span>`;
        this._el.appendChild(line);
        this._el.scrollTop = this._el.scrollHeight;
      }
      while (this._el.children.length > this._maxLines)
        this._el.removeChild(this._el.firstChild);
    });

    EventBus.on("run:done", ({ results }) => {
      const found = results.filter((r) => r.success).length;
      const total = results.length;
      this.plain(`■ Done — ${found}/${total} found a path.`);
    });

    EventBus.on("run:reset", () => {
      this.plain("↺ Visualization reset.");
    });

    EventBus.on("action:clearAll", () => {
      this.plain("✕ Grid cleared.");
    });

    EventBus.on("terrain:maze", () => {
      this.info("⬡ Maze generated (recursive backtracker).");
    });

    EventBus.on("terrain:scatter", () => {
      this.info("· Walls scattered at 30% density.");
    });

    EventBus.on("terrain:clearWalls", () => {
      this.plain("▪ Walls cleared.");
    });

    EventBus.on("grid:resized", ({ rows, cols }) => {
      this.info(`Grid resized to ${rows}×${cols} (${rows * cols} nodes).`);
    });

    EventBus.on("settings:changed", ({ key, value }) => {
      const msgs = {
        heuristic: `Heuristic → ${value}`,
        movement: `Movement → ${value}-directional`,
        showHeatmap: `Heatmap ${value ? "on" : "off"}`,
        dynamicMode: `Dynamic obstacles turned ${value ? "on" : "off"}`,
      };
      if (msgs[key]) this.plain(msgs[key]);
    });
  }

  // ── Utility ────────────────────────────────────

  _escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
