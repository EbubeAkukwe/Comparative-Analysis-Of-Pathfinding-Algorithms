/**
 * PathLab — Dijkstra's Algorithm
 *
 * Generalization of BFS to weighted graphs. Uses a min-heap
 * ordered by cumulative cost g(n). Equivalent to A* with h=0.
 * Explores more of the graph than A* but makes no assumptions
 * about the layout of the search space.
 *
 * Time:  O((V + E) log V)
 * Space: O(V)
 * Optimal: Yes
 * Complete: Yes
 */
import { AlgorithmBase } from "./AlgorithmBase.js";
import { MinHeap } from "../core/MinHeap.js";
import { Grid } from "../core/Grid.js";

export class Dijkstra extends AlgorithmBase {
  *solve() {
    const { grid, dirs8 } = this;
    const start = this.startCell;
    const goal = this.goalCell;

    const trackPeak = () => {
      // Use the specific variables relevant to the algorithm (e.g., openSet, visited, gScore)
      peakEntries = Math.max(peakEntries, openSet.size ?? 0, dist?.size ?? 0);
    };

    if (!start || !goal) {
      yield {
        type: "done",
        success: false,
        path: [],
        nodesExpanded: 0,
        pathCost: dist.get(key) ?? Infinity,
        peakMemoryBytes: this.estimateBytes(peakEntries),
      };
      return;
    }

    let peakEntries = 0;

    const startKey = Grid.key(start);

    // Min-heap keyed by g-score (cost from start)
    const openSet = new MinHeap((a, b) => a.g - b.g);
    const dist = new Map([[startKey, 0]]);
    const cameFrom = new Map([[startKey, null]]);
    const closed = new Set();

    openSet.push({ g: 0, cell: start });
    trackPeak();

    let nodesExpanded = 0;

    while (!openSet.empty) {
      const { g, cell: current } = openSet.pop();
      const key = Grid.key(current);

      // Skip stale entries (lazy deletion)
      if (g > (dist.get(key) ?? Infinity)) continue;

      // Already processed
      if (closed.has(key)) continue;
      closed.add(key);

      nodesExpanded++;

      // Goal check
      if (this.isGoal(current)) {
        const path = this.reconstructPath(cameFrom, current);
        for (let i = 1; i < path.length; i++) {
          yield { type: "path", r: path[i].r, c: path[i].c };
        }
        yield {
          type: "done",
          success: true,
          path,
          nodesExpanded,
          pathCost: dist.get(key) ?? Infinity,
          peakMemoryBytes: this.estimateBytes(peakEntries),
        };
        return;
      }

      yield { type: "visit", r: current.r, c: current.c, cost: g };

      for (const nb of grid.neighbors(current.r, current.c, dirs8)) {
        const nbKey = Grid.key(nb);
        if (closed.has(nbKey)) continue;

        const newG = g + grid.edgeCost(current, nb);
        if (newG < (dist.get(nbKey) ?? Infinity)) {
          dist.set(nbKey, newG);
          trackPeak();
          cameFrom.set(nbKey, current);
          peakEntries = Math.max(peakEntries, dist.size, openSet.size);
          openSet.push({ g: newG, cell: nb });
          trackPeak();
        }
      }
    }

    yield {
      type: "done",
      success: false,
      path: [],
      nodesExpanded,
      pathCost: dist.get(key) ?? Infinity,
      peakMemoryBytes: this.estimateBytes(peakEntries),
    };
  }
}
