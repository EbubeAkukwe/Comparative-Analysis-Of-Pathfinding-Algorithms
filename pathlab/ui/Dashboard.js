/**
 * PathLab — Dashboard
 * Manages the right-panel research dashboard.
 * Displays metrics, comparison table, bar charts, and success rates.
 * Subscribes to run:result and run:done EventBus events.
 */
import { EventBus } from "../core/EventBus.js";
import { PluginRegistry } from "../plugins/PluginRegistry.js";
import { State, recordResult } from "../core/StateManager.js";

export class Dashboard {
  /**
   * @param {HTMLElement} panelEl — #panel-right
   */
  constructor(panelEl) {
    this._el = panelEl;

    // Persist results across runs for success rate
    /** @type {Map<string, {runs:number, successes:number, last:Object}>} */
    this._history = new Map();

    this._bindEvents();
  }

  // ── EventBus ───────────────────────────────────

  _bindEvents() {
    EventBus.on("run:result", (result) => {
      this._updateHistory(result);
      recordResult(result);

      // Only update cards that aren't the batch memory array
      this._updateMetricCards(result);

      // Replan metrics — only meaningful when ECF is active
      const dynamicOn = (State?.ecf ?? 0) > 0;
      const replanSection = document.getElementById("replan-section");
      if (replanSection) replanSection.style.display = dynamicOn ? "" : "none";

      if (dynamicOn) {
        this._set("m-replan-count", result.replanCount ?? "—");
        this._set("m-replan-nodes", result.replanNodes ?? "—");
      }

      // REMOVE or COMMENT OUT the memory update here:
      // this._set("m-memory", ...);
    });

    EventBus.on("run:done", ({ results, memorySummary }) => {
      this._updateComparisonTable(results);
      this._updateBarCharts(results);
      this._updateSuccessRates();

      // Handle the batch memory display here
      if (memorySummary) {
        this._set("m-memory", `[${memorySummary.join(", ")}] B`);
      }
    });

    EventBus.on("action:clearAll", () => {
      this._history.clear();
      this._clearAll();
    });

    EventBus.on("action:resetRun", () => {
      this._clearMetricCards();
    });
  }

  // ── History tracking ───────────────────────────

  _updateHistory(result) {
    const existing = this._history.get(result.name) ?? {
      runs: 0,
      successes: 0,
      last: null,
    };
    this._history.set(result.name, {
      runs: existing.runs + 1,
      successes: existing.successes + (result.success ? 1 : 0),
      last: result,
    });
  }

  // ── Metric cards ───────────────────────────────

  _updateMetricCards(result) {
    this._set(
      "m-runtime",
      result.runtime_ms != null ? result.runtime_ms.toFixed(3) : "—",
    );
    this._set(
      "m-expanded",
      result.nodesExpanded != null ? String(result.nodesExpanded) : "—",
    );
    this._set(
      "m-cost",
      result.success && isFinite(result.pathCost)
        ? result.pathCost.toFixed(2)
        : result.success
          ? "—"
          : "∞",
    );
    this._set(
      "m-length",
      result.success && result.pathLength > 0
        ? String(result.pathLength)
        : result.success
          ? "—"
          : "—",
    );
    this._set(
      "m-memory",
      result.memoryBytes != null
        ? `${result.memoryBytes.toLocaleString()} B`
        : "—",
    );

    // Pulse the runtime card to signal new data
    const card = document.getElementById("m-runtime")?.closest(".metric-card");
    if (card) {
      card.classList.add("highlight");
      setTimeout(() => card.classList.remove("highlight"), 600);
    }
  }

  _clearMetricCards() {
    ["m-runtime", "m-expanded", "m-cost", "m-length", "m-memory"].forEach(
      (id) => this._set(id, "—"),
    );
  }

  // ── Comparison table ───────────────────────────

  _updateComparisonTable(results) {
    const tbody = document.getElementById("comp-tbody");
    if (!tbody) return;
    if (!results.length) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">No results yet</td></tr>';
      return;
    }

    // Find best/worst for expanded and cost
    const expandedVals = results
      .filter((r) => r.success)
      .map((r) => r.nodesExpanded);
    const costVals = results
      .filter((r) => r.success && isFinite(r.pathCost))
      .map((r) => r.pathCost);
    const minExpanded = Math.min(...expandedVals);
    const maxExpanded = Math.max(...expandedVals);
    const minCost = Math.min(...costVals);
    const maxCost = Math.max(...costVals);

    tbody.innerHTML = results
      .map((r) => {
        const info = PluginRegistry.get(r.name);

        const expClass = !r.success
          ? "td-na"
          : r.nodesExpanded === minExpanded
            ? "td-best"
            : r.nodesExpanded === maxExpanded
              ? "td-worst"
              : "";

        const costRaw = r.success && isFinite(r.pathCost) ? r.pathCost : null;
        const costClass =
          costRaw == null
            ? "td-na"
            : costRaw === minCost
              ? "td-best"
              : costRaw === maxCost
                ? "td-worst"
                : "";

        const costDisplay = costRaw != null ? costRaw.toFixed(1) : "∞";
        const expDisplay = r.success ? r.nodesExpanded : "—";
        const rtDisplay = r.runtime_ms != null ? r.runtime_ms.toFixed(1) : "—";

        return `
        <tr>
          <td class="td-name">
            <span class="td-name-inner">
              <span class="td-swatch" style="background:${info?.color ?? "#888"}"></span>
              ${r.name}
            </span>
          </td>
          <td>${rtDisplay}</td>
          <td class="${expClass}">${expDisplay}</td>
          <td class="${costClass}">${costDisplay}</td>
        </tr>`;
      })
      .join("");
  }

  // ── Bar charts ─────────────────────────────────

  _updateBarCharts(results) {
    this._renderBarChart(
      "bar-chart-expanded",
      results,
      (r) => (r.success ? (r.nodesExpanded ?? 0) : 0),
      (v) => v.toFixed(0),
    );
    this._renderBarChart(
      "bar-chart-cost",
      results,
      (r) => (r.success && isFinite(r.pathCost) ? r.pathCost : 0),
      (v) => v.toFixed(1),
    );
    this._renderBarChart(
      "bar-chart-runtime",
      results,
      (r) => r.runtime_ms ?? 0,
      (v) => `${v.toFixed(2)}ms`,
    );
  }

  _renderBarChart(id, results, valueFn, formatFn) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!results.length) {
      el.innerHTML = "";
      return;
    }

    const values = results.map(valueFn);
    const maxVal = Math.max(1, ...values);

    el.innerHTML = results
      .map((r, i) => {
        const info = PluginRegistry.get(r.name);
        const v = values[i];
        const pct = Math.round((v / maxVal) * 100);
        const color = info?.color ?? "#888";

        return `
        <div class="bar-row">
          <span class="bar-name" title="${r.name}">${info?.shortName ?? r.name}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="bar-val">${formatFn(v)}</span>
        </div>`;
      })
      .join("");
  }

  // ── Success rates ──────────────────────────────

  _updateSuccessRates() {
    const el = document.getElementById("success-rows");
    if (!el) return;

    const rows = [];
    for (const [name, data] of this._history) {
      const info = PluginRegistry.get(name);
      const pct =
        data.runs > 0 ? Math.round((data.successes / data.runs) * 100) : 0;
      const cls = pct === 100 ? "full" : pct === 0 ? "none" : "part";
      rows.push(`
        <div class="success-row">
          <span class="success-algo-name">
            <span class="td-swatch" style="background:${info?.color ?? "#888"}"></span>
            ${name}
          </span>
          <span class="success-pct ${cls}">${pct}%</span>
        </div>`);
    }
    el.innerHTML = rows.length
      ? rows.join("")
      : '<span class="empty-state">Run algorithms to see rates</span>';
  }

  // ── Utilities ──────────────────────────────────

  _set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _clearAll() {
    this._clearMetricCards();
    const tbody = document.getElementById("comp-tbody");
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="4" class="empty-state">Run algorithms to compare</td></tr>';
    ["bar-chart-expanded", "bar-chart-cost", "bar-chart-runtime"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
      },
    );
    const sr = document.getElementById("success-rows");
    if (sr) sr.innerHTML = '<span class="empty-state">No data yet</span>';
  }
}
