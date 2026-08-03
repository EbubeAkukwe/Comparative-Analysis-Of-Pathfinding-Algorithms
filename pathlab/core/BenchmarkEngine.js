/**
 * PathLab — BenchmarkEngine
 * Runs algorithms synchronously (no animation) to collect clean metrics.
 * Used for the research dashboard comparison table.
 *
 * For animated runs, see AlgorithmRunner.
 */
export class BenchmarkEngine {
  /**
   * @param {import('./Grid.js').Grid} grid
   */
  constructor(grid) {
    this._grid = grid;
    /** @type {Map<string, BenchmarkResult>} */
    this.results = new Map();
    this._runs = new Map(); // name -> run count
    this._successes = new Map(); // name -> success count
  }

  /**
   * Run a single algorithm to completion, timing it with performance.now().
   * @param {string} name
   * @param {import('../plugins/PluginRegistry.js').PluginEntry} algoInfo
   * @param {string} heuristic
   * @param {boolean} dirs8
   * @returns {BenchmarkResult}
   */
  run(name, algoInfo, heuristic, dirs8) {
    const algo = new algoInfo.cls(this._grid, heuristic, dirs8);
    const gen = algo.solve();

    let nodesExpanded = 0;
    let pathCost = 0;
    let pathLength = 0;
    let success = false;
    let path = [];
    let lastStep = null;

    const t0 = performance.now();

    for (const step of gen) {
      switch (step.type) {
        case "visit":
          nodesExpanded++;
          break;
        case "done":
          success = step.success;
          path = step.path ?? [];
          pathCost = step.pathCost ?? Infinity;
          pathLength = path.length;
          lastStep = step;
          break;
      }
    }

    const runtime_ms = performance.now() - t0;

    const result = {
      name,
      runtime_ms,
      nodesExpanded,
      pathCost: success ? pathCost : Infinity,
      pathLength: success ? pathLength : 0,
      success,
      memoryBytes: lastStep?.peakMemoryBytes ?? 0,
      path,
      heuristic,
      dirs8,
      timestamp: Date.now(),
    };

    this.results.set(name, result);
    this._runs.set(name, (this._runs.get(name) ?? 0) + 1);
    if (success)
      this._successes.set(name, (this._successes.get(name) ?? 0) + 1);

    return result;
  }

  /**
   * Run all provided algorithms and return all results.
   * @param {string[]} names
   * @param {Map<string, import('../plugins/PluginRegistry.js').PluginEntry>} registry
   * @param {string} heuristic
   * @param {boolean} dirs8
   * @returns {BenchmarkResult[]}
   */
  runAll(names, registry, heuristic, dirs8) {
    return names
      .map((name) => {
        const info = registry.get(name);
        if (!info) return null;
        return this.run(name, info, heuristic, dirs8);
      })
      .filter(Boolean);
  }

  /**
   * Success rate for an algorithm across all runs.
   * @param {string} name
   * @returns {number} 0–1
   */
  successRate(name) {
    const total = this._runs.get(name) ?? 0;
    if (total === 0) return 0;
    return (this._successes.get(name) ?? 0) / total;
  }

  /**
   * All stored results as an array, sorted by nodes expanded (ascending).
   * @returns {BenchmarkResult[]}
   */
  getAllSorted() {
    return Array.from(this.results.values()).sort(
      (a, b) => a.nodesExpanded - b.nodesExpanded,
    );
  }

  /**
   * Clear all stored results (keeps run/success counts for success rate).
   */
  clearResults() {
    this.results.clear();
  }

  /**
   * Full reset — clears results and run counts.
   */
  reset() {
    this.results.clear();
    this._runs.clear();
    this._successes.clear();
  }
}

/**
 * @typedef {Object} BenchmarkResult
 * @property {string}   name
 * @property {number}   runtime_ms
 * @property {number}   nodesExpanded
 * @property {number}   pathCost
 * @property {number}   lastStep
 * @property {number}   pathLength
 * @property {boolean}  success
 * @property {number}   memoryBytes
 * @property {Array}    path
 * @property {string}   heuristic
 * @property {boolean}  dirs8
 * @property {number}   timestamp
 */
