/**
 * PathLab — A* Search
 *
 * Combines Dijkstra's g(n) (cost from start) with a heuristic
 * estimate h(n) (cost to goal). Sorts the open set by:
 *   f(n) = g(n) + h(n)
 *
 * With an admissible heuristic, A* is optimally efficient —
 * it expands the minimum nodes needed to guarantee optimality.
 * With a consistent heuristic it never re-expands nodes.
 *
 * Time:  O(b^d) in the best case with a perfect heuristic
 * Space: O(b^d) — open set can grow exponentially
 * Optimal: Yes (admissible heuristic)
 * Complete: Yes (finite graph)
 */
import { AlgorithmBase } from "./AlgorithmBase.js";
import { MinHeap } from "../core/MinHeap.js";
import { Grid } from "../core/Grid.js";

export class AStar extends AlgorithmBase {
  *solve() {
    const { grid, dirs8, h } = this;
    const start = this.startCell;
    const goal = this.goalCell;

    const trackPeak = () => {
      // Use the specific variables relevant to the algorithm (e.g., openSet, visited, gScore)
      peakEntries = Math.max(peakEntries, openSet.size ?? 0, gScore?.size ?? 0);
    };

    if (!start || !goal) {
      yield {
        type: "done",
        success: false,
        path: [],
        nodesExpanded: 0,
        pathCost: gScore.get(key) ?? Infinity,
        peakMemoryBytes: this.estimateBytes(peakEntries),
      };
      return;
    }

    let peakEntries = 0;

    const startKey = Grid.key(start);

    const gScore = new Map([[startKey, 0]]);
    const fScore = new Map([[startKey, h(start, goal)]]);
    const cameFrom = new Map([[startKey, null]]);
    const closed = new Set();

    // Min-heap ordered by f(n)
    const openSet = new MinHeap((a, b) => {
      const fa = fScore.get(Grid.key(a.cell)) ?? Infinity;
      const fb = fScore.get(Grid.key(b.cell)) ?? Infinity;
      return fa - fb;
    });
    openSet.push({ cell: start });
    trackPeak();

    // Track which cells are in the open set to avoid duplicates
    const inOpen = new Set([startKey]);

    let nodesExpanded = 0;

    while (!openSet.empty) {
      const { cell: current } = openSet.pop();
      const key = Grid.key(current);

      inOpen.delete(key);

      // Skip if already expanded (stale heap entry)
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
          pathCost: gScore.get(key) ?? Infinity,
          peakMemoryBytes: this.estimateBytes(peakEntries),
        };
        return;
      }

      yield {
        type: "visit",
        r: current.r,
        c: current.c,
        cost: gScore.get(key) ?? 0,
      };

      for (const nb of grid.neighbors(current.r, current.c, dirs8)) {
        const nbKey = Grid.key(nb);
        if (closed.has(nbKey)) continue;

        const tentativeG =
          (gScore.get(key) ?? Infinity) + grid.edgeCost(current, nb);

        if (tentativeG < (gScore.get(nbKey) ?? Infinity)) {
          cameFrom.set(nbKey, current);
          gScore.set(nbKey, tentativeG);
          trackPeak();
          fScore.set(nbKey, tentativeG + h(nb, goal));

          peakEntries = Math.max(peakEntries, gScore.size, openSet.size);

          if (!inOpen.has(nbKey)) {
            inOpen.add(nbKey);
            openSet.push({ cell: nb });
          }
          // If already in open, the heap will have a stale entry.
          // The closed set check handles re-expansion correctly.
        }
      }
    }

    yield {
      type: "done",
      success: false,
      path: [],
      nodesExpanded,
      pathCost: gScore.get(key) ?? Infinity,
      peakMemoryBytes: this.estimateBytes(peakEntries),
    };
  }
}
