/**
 * PathLab — BFS (Breadth-First Search)
 *
 * Explores all nodes at depth d before any at depth d+1.
 * Guaranteed to find the shortest path by edge count on
 * unweighted graphs. Does not use a heuristic.
 *
 * Time:  O(V + E)
 * Space: O(V)
 * Optimal: Yes (unweighted / uniform cost)
 * Complete: Yes
 */
import { AlgorithmBase } from "./AlgorithmBase.js";
import { Grid } from "../core/Grid.js";

export class BFS extends AlgorithmBase {
  *solve() {
    const { grid, dirs8 } = this;
    const start = this.startCell;
    const goal = this.goalCell;

    const trackPeak = () => {
      // Use the specific variables relevant to the algorithm (e.g., openSet, visited, gScore)
      peakEntries = Math.max(
        peakEntries,
        queue.length ?? 0,
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

    // FIFO queue holds cells
    const queue = [start];
    const visited = new Set([startKey]);
    const cameFrom = new Map([[startKey, null]]);

    let nodesExpanded = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      nodesExpanded++;

      // Goal check
      if (this.isGoal(current)) {
        const path = this.reconstructPath(cameFrom, current);
        // Yield path steps for animation
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

      yield { type: "visit", r: current.r, c: current.c, cost: 0 };

      for (const nb of grid.neighbors(current.r, current.c, dirs8)) {
        const key = Grid.key(nb);
        if (!visited.has(key)) {
          visited.add(key);
          trackPeak();
          cameFrom.set(key, current);
          peakEntries = Math.max(peakEntries, visited.size, queue.length);
          queue.push(nb);
          trackPeak();
        }
      }
    }

    // No path found
    yield {
      type: "done",
      success: false,
      path: [],
      nodesExpanded,
      pathCost: 0 ?? Infinity,
      peakMemoryBytes: this.estimateBytes(peakEntries),
    };
  }
}
