/**
 * PathLab — EducationalModal
 * Tabbed educational overlay covering:
 *   - Algorithm explanations with pseudocode
 *   - Heuristic guide with formulas
 *   - Complexity analysis table
 *   - Usage guide with keyboard shortcuts
 */
import { EventBus } from "../core/EventBus.js";
import {
  ALGO_META,
  HEURISTIC_META,
  COMPLEXITY_TABLE,
} from "../data/algorithmMeta.js";
import { PluginRegistry } from "../plugins/PluginRegistry.js";

const TABS = [
  "algorithms",
  "heuristics",
  "complexity",
  "usage",
  "researcher-note",
];

export class EducationalModal {
  constructor() {
    this._activeTab = "researcher-note";
    this._backdrop = document.getElementById("modal-backdrop");
    this._body = document.getElementById("modal-body");
    this._bindTabClicks();
    this._bindClose();
    this._bindEventBus();
  }

  // ── Public ─────────────────────────────────────

  open(tab = "researcher-note") {
    this._activeTab = TABS.includes(tab) ? tab : "researcher-note";
    this._render();
    this._backdrop.classList.add("open");
    this._syncTabs();
    // Trap focus
    this._backdrop.focus?.();
  }

  close() {
    this._backdrop.classList.remove("open");
  }

  // ── Binding ────────────────────────────────────

  _bindTabClicks() {
    document.querySelectorAll(".modal-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        this._activeTab = tab.dataset.tab;
        this._render();
        this._syncTabs();
      });
    });
  }

  _bindClose() {
    document
      .getElementById("modal-close")
      ?.addEventListener("click", () => this.close());
    this._backdrop?.addEventListener("click", (e) => {
      if (e.target === this._backdrop) this.close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this._backdrop?.classList.contains("open"))
        this.close();
    });
  }

  _bindEventBus() {
    EventBus.on("modal:open", ({ tab }) => this.open(tab));
    EventBus.on("modal:close", () => this.close());
  }

  _syncTabs() {
    document.querySelectorAll(".modal-tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === this._activeTab);
    });
  }

  // ── Rendering ──────────────────────────────────

  _render() {
    if (!this._body) return;
    switch (this._activeTab) {
      case "researcher-note":
        this._body.innerHTML = this._renderResearcherNote();
        break;
      case "algorithms":
        this._body.innerHTML = this._renderAlgorithms();
        break;
      case "heuristics":
        this._body.innerHTML = this._renderHeuristics();
        break;
      case "complexity":
        this._body.innerHTML = this._renderComplexity();
        break;
      case "usage":
        this._body.innerHTML = this._renderUsage();
        break;
    }
  }

  // ── Algorithms tab ─────────────────────────────

  _renderAlgorithms() {
    return PluginRegistry.names()
      .map((name) => {
        const info = PluginRegistry.get(name);
        const meta = ALGO_META[name];
        if (!meta) return "";

        const optBadge = meta.optimal
          ? `<span style="color:var(--go);font-size:11px">✓ Optimal</span>`
          : `<span style="color:var(--danger);font-size:11px">✗ Not optimal</span>`;

        const hBadge = meta.usesHeuristic
          ? `<span style="color:var(--accent);font-size:11px">Uses heuristic</span>`
          : `<span style="color:var(--muted);font-size:11px">No heuristic</span>`;

        return `
        <div class="edu-section">
          <h3>
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
              background:${info?.color};margin-right:6px;vertical-align:middle"></span>
            ${meta.fullName}
            <span class="algo-tag">${name}</span>
          </h3>
          <div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap">
            ${optBadge} ${hBadge}
            <span style="color:var(--muted);font-size:11px">Time: ${meta.timeComplexity}</span>
            <span style="color:var(--muted);font-size:11px">Space: ${meta.spaceComplexity}</span>
          </div>
          <p>${meta.description}</p>
          <p><strong style="color:var(--bright)">Best for:</strong> ${meta.bestFor}</p>
          <div class="formula-block">
            <div style="color:var(--muted);font-size:11px;margin-bottom:4px"># Pseudocode</div>
            <pre style="white-space:pre;font-family:var(--font-mono);font-size:12px;color:var(--body);margin:0">${this._escHtml(meta.pseudocode.trim())}</pre>
          </div>
        </div>`;
      })
      .join("");
  }

  // ── Heuristics tab ─────────────────────────────

  _renderHeuristics() {
    const sections = Object.entries(HEURISTIC_META)
      .map(([key, meta]) => {
        const a4 = meta.admissible4 ? "✓" : "✗";
        const a8 = meta.admissible8 ? "✓" : "✗";
        const a4c = meta.admissible4 ? "c-good" : "c-bad";
        const a8c = meta.admissible8 ? "c-good" : "c-bad";

        return `
        <div class="edu-section">
          <h3>${meta.label} <span class="algo-tag">${key}</span></h3>
          <div class="formula-block">
            <span style="color:var(--teal)">${meta.formula}</span>
          </div>
          <p>${meta.description}</p>
          <table style="font-size:12px;border-collapse:collapse;margin-top:8px">
            <tr>
              <td style="padding:4px 12px 4px 0;color:var(--muted)">Admissible (4-dir)</td>
              <td class="${a4c}" style="font-weight:700">${a4}</td>
            </tr>
            <tr>
              <td style="padding:4px 12px 4px 0;color:var(--muted)">Admissible (8-dir)</td>
              <td class="${a8c}" style="font-weight:700">${a8}</td>
            </tr>
          </table>
          <div class="note"><strong>Tip:</strong> ${meta.tip}</div>
        </div>`;
      })
      .join("");

    return (
      sections +
      `
      <div class="edu-section">
        <h3>Admissibility &amp; Consistency</h3>
        <p>A heuristic is <strong style="color:var(--bright)">admissible</strong> if it never 
        overestimates the true cost to the goal. A* with an admissible heuristic is guaranteed 
        to return an optimal path.</p>
        <p>A heuristic is <strong style="color:var(--bright)">consistent</strong> (monotone) if 
        <code>h(n) ≤ cost(n, n') + h(n')</code> for all edges. Consistency implies admissibility 
        and ensures A* never re-expands a closed node — guaranteeing O(V) closed-set operations.</p>
        <div class="note">
          <strong>Rule of thumb:</strong> Manhattan for 4-dir, Chebyshev for 8-dir, 
          Euclidean for both (slightly weaker but always safe).
        </div>
      </div>`
    );
  }

  // ── Complexity tab ─────────────────────────────

  _renderComplexity() {
    const rows = COMPLEXITY_TABLE.map((row) => {
      const info = PluginRegistry.get(row.name);
      return `
        <tr>
          <td>
            <span style="display:inline-flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${info?.color ?? "#888"};flex-shrink:0"></span>
              ${row.name}
            </span>
          </td>
          <td>${row.time}</td>
          <td>${row.space}</td>
          <td>${row.optimal}</td>
          <td>${row.complete}</td>
        </tr>`;
    }).join("");

    return `
      <div class="edu-section">
        <h3>Time &amp; Space Complexity</h3>
        <div class="complexity-table-wrap">
          <table class="complexity-table">
            <thead>
              <tr>
                <th>Algorithm</th>
                <th>Time</th>
                <th>Space</th>
                <th>Optimal</th>
                <th>Complete</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="margin-top:12px;font-size:12px;color:var(--muted)">
          V = vertices, E = edges, b = branching factor, d = solution depth, 
          m = max depth, k = number of changed edges (D* Lite).
        </p>
      </div>
      <div class="edu-section">
        <h3>Practical performance on this platform</h3>
        <p>On a 25×40 uniform-cost grid with no obstacles, you typically see:
        <strong style="color:var(--bright)"> Greedy BFS</strong> expands the fewest nodes 
        (follows heuristic directly) but produces a longer path. 
        <strong style="color:var(--accent)">A*</strong> balances exploration and cost, 
        expanding 40–70% fewer nodes than Dijkstra. 
        <strong style="color:var(--go)">Dijkstra</strong> and <strong style="color:var(--algo-bfs)">BFS</strong> 
        explore nearly everything before finding the path in an obstacle-free grid.
        <strong style="color:var(--teal)">D* Lite</strong>'s advantage is only visible 
        with dynamic obstacles enabled — enable the toggle and draw walls during a run.</p>
      </div>`;
  }

  // ── Usage tab ──────────────────────────────────

  _renderUsage() {
    return `
      <div class="edu-section">
        <h3>Quick start</h3>
        <div class="usage-steps">
          <div class="usage-step">
            <div class="usage-step-num">1</div>
            <div class="usage-step-text">
              The green <strong>S</strong> is your start node and amber <strong>G</strong> is the goal.
              Use <strong>Set start</strong> and <strong>Set goal</strong> tools to reposition them.
            </div>
          </div>
          <div class="usage-step">
            <div class="usage-step-num">2</div>
            <div class="usage-step-text">
              Select <strong>Place wall</strong> then click or drag on the grid to add obstacles.
              Right-click anywhere to erase. Use <strong>Generate maze</strong> for a perfect maze.
            </div>
          </div>
          <div class="usage-step">
            <div class="usage-step-num">3</div>
            <div class="usage-step-text">
              Check which algorithms to run in the left panel. All checked algorithms race 
              simultaneously so you can compare their expansion patterns side-by-side.
            </div>
          </div>
          <div class="usage-step">
            <div class="usage-step-num">4</div>
            <div class="usage-step-text">
              Click <strong>Run selected</strong>. Watch the heatmap fill in — 
              blue = explored early, amber/red = explored later. 
              Paths are drawn in each algorithm's color.
            </div>
          </div>
          <div class="usage-step">
            <div class="usage-step-num">5</div>
            <div class="usage-step-text">
              Read the comparison table and bar charts in the right panel. 
              Green = best value, red = worst. Run multiple times to build up success rates.
            </div>
          </div>
        </div>
      </div>

      <div class="edu-section">
        <h3>Tips &amp; tricks</h3>
        <p><strong style="color:var(--bright)">Heatmap</strong> — toggle off to see raw 
        per-algorithm colours instead of the exploration density gradient.</p>
        <p><strong style="color:var(--bright)">Dynamic obstacles</strong> — enable the toggle, 
        set the Environment Change Frequency (ECF) value, then start a run. D* Lite will replan; 
        other algorithms restart from their current frontier position.</p>
        <p><strong style="color:var(--bright)">Step once</strong> — advances all running 
        algorithms exactly one node each. Ideal for understanding expansion order in detail.</p>
        <p><strong style="color:var(--bright)">Speed slider</strong> — drag left for slow 
        (educational), right for fast (benchmark). At maximum(0 ms), algorithms run at near-native 
        JS speed with no animation delay.</p>
        <p><strong style="color:var(--bright)">Extending PathLab</strong> — register a new 
        algorithm at runtime: <code>PluginRegistry.register(name, { cls, color, shortName, supportsH })</code>. 
        Any class extending AlgorithmBase with a generator <code>solve()</code> method will 
        automatically appear in the algorithm list and dashboards.</p>
      </div>

      <div class="edu-section">
        <h3>Keyboard shortcuts</h3>
        <div class="shortcut-grid">
          <div class="shortcut-item"><span class="key-badge">R</span> Run / Pause</div>
          <div class="shortcut-item"><span class="key-badge">Space</span> Step once</div>
          <div class="shortcut-item"><span class="key-badge">Esc</span> Reset run</div>
          <div class="shortcut-item"><span class="key-badge">W</span> Wall tool</div>
          <div class="shortcut-item"><span class="key-badge">E</span> Erase tool</div>
          <div class="shortcut-item"><span class="key-badge">S</span> Set start</div>
          <div class="shortcut-item"><span class="key-badge">G</span> Set goal</div>
          <div class="shortcut-item"><span class="key-badge">M</span> Generate maze</div>
          <div class="shortcut-item"><span class="key-badge">?</span> Open guide</div>
          <div class="shortcut-item"><span class="key-badge">Delete</span> Clear all</div>
        </div>
      </div>`;
  }

  // ── Researcher's Note tab ──────────────────────────────────

  _renderResearcherNote() {
    return `
    <div class="edu-section">
      <h3>Researcher's Note</h3>
      <p>Insert your research text here...</p>
    </div>`;
  }

  // ── Utilities ──────────────────────────────────

  _escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
