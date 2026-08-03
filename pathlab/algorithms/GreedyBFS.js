/**
 * PathLab — Greedy Best-First Search
 *
 * Like A* but sorts the open set by h(n) alone — the estimated
 * cost to the goal — ignoring the cost already incurred g(n).
 *
 * This makes it very fast at reaching the goal in simple environments,
 * but sacrifices optimality. It can be misled by the heuristic and
 * produce paths that are significantly longer than optimal.
 *
 * Time:  O(b^m) worst case, often much better in practice
 * Space: O(b^m)
 * Optimal: No — may find a suboptimal path
 * Complete: Yes (finite graph without cycles causing infinite loops)
 */
import { AlgorithmBase } from "./AlgorithmBase.js";
import { MinHeap } from "../core/MinHeap.js";
import { Grid } from "../core/Grid.js";

export class GreedyBFS extends AlgorithmBase {
  *solve() {
    const { grid, dirs8, h } = this;
    const start = this.startCell;
    const goal = this.goalCell;

    const trackPeak = () => {
      // Use the specific variables relevant to the algorithm (e.g., openSet, visited, gScore)
      peakEntries = Math.max(
        peakEntries,
        openSet.size ?? 0,
        visited?.size ?? 0,
      );
    };

    if (!start || !goal) {
      yield {
        type: "done",
        success: false,
        path: [],
        nodesExpanded: 0,
        pathCost: this.pathCost(path) ?? Infinity,
        peakMemoryBytes: this.estimateBytes(peakEntries),
      };
      return;
    }

    let peakEntries = 0;

    const startKey = Grid.key(start);

    // Min-heap ordered solely by heuristic h(n)
    const openSet = new MinHeap((a, b) => a.hVal - b.hVal);
    const visited = new Set([startKey]);
    const cameFrom = new Map([[startKey, null]]);

    openSet.push({ hVal: h(start, goal), cell: start });
    trackPeak();

    let nodesExpanded = 0;

    while (!openSet.empty) {
      const { cell: current } = openSet.pop();
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
          pathCost: this.pathCost(path),
          peakMemoryBytes: this.estimateBytes(peakEntries),
        };
        return;
      }

      yield {
        type: "visit",
        r: current.r,
        c: current.c,
        cost: h(current, goal),
      };

      for (const nb of grid.neighbors(current.r, current.c, dirs8)) {
        const key = Grid.key(nb);
        if (!visited.has(key)) {
          visited.add(key);
          cameFrom.set(key, current);
          peakEntries = Math.max(peakEntries, visited.size, openSet.size);
          openSet.push({ hVal: h(nb, goal), cell: nb });
          trackPeak();
        }
      }
    }

    yield {
      type: "done",
      success: false,
      path: [],
      nodesExpanded,
      pathCost: this.pathCost(path) ?? Infinity,
      peakMemoryBytes: this.estimateBytes(peakEntries),
    };
  }
}
