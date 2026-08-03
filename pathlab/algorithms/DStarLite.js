/**
 * PathLab — D* Lite
 *
 * D* Lite (Koenig & Likhachev, 2002) is an incremental replanning
 * algorithm designed for dynamic environments where edge costs can
 * change after planning begins.
 *
 * Key idea: Plan BACKWARDS from goal to start. Maintain two estimates
 * per node:
 *   g(n)   — current best cost from n to goal
 *   rhs(n) — one-step lookahead from n's neighbours toward goal
 *
 * A node is "consistent" when g(n) == rhs(n). Inconsistent nodes
 * go into the priority queue for updating.
 *
 * When an edge cost changes (obstacle added/removed), only affected
 * nodes are re-queued — far cheaper than replanning from scratch.
 *
 * The path is extracted by greedy gradient descent from start to goal
 * along the g-values computed by the backward search.
 *
 * Time:  O(k log k) per replan, k = changed edges
 * Space: O(V)
 * Optimal: Yes
 * Complete: Yes
 */
import { AlgorithmBase } from "./AlgorithmBase.js";
import { MinHeap } from "../core/MinHeap.js";
import { Grid } from "../core/Grid.js";

const INF = Infinity;

export class DStarLite extends AlgorithmBase {
  *solve() {
    let replanCount = 0;
    let replanNodes = 0;
    let isReplanning = false;
    const { grid, dirs8, h } = this;
    const s_start = this.startCell;
    const s_goal = this.goalCell;

    const inQueue = new Map();

    const trackPeak = () => {
      // Use the specific variables relevant to the algorithm (e.g., openSet, visited, gScore)
      peakEntries = Math.max(
        peakEntries,
        g.size ?? 0,
        rhs.size ?? 0,
        inQueue.size ?? 0,
      );
    };

    if (!s_start || !s_goal) {
      yield {
        type: "done",
        success: false,
        path: [],
        nodesExpanded: 0,
        pathCost: INF,
        peakMemoryBytes: this.estimateBytes(peakEntries),
      };
      return;
    }

    let peakEntries = 0;

    // ── D* Lite internal state ─────────────────────

    /** g-values: cost estimate from node to goal (backward) */
    const g = new Map();
    /** rhs-values: one-step lookahead cost to goal */
    const rhs = new Map();

    const key = (cell) => Grid.key(cell);

    const getG = (cell) => g.get(key(cell)) ?? INF;
    const getRhs = (cell) => rhs.get(key(cell)) ?? INF;
    const setG = (cell, v) => g.set(key(cell), v);
    const setRhs = (cell, v) => rhs.set(key(cell), v);

    trackPeak();

    // k_m: key modifier, incremented when start moves (not used here since
    // start is fixed, but included for correctness)
    let k_m = 0;

    // ── Priority queue ─────────────────────────────

    /**
     * Calculate D* Lite priority key for a cell.
     * [min(g,rhs) + h(start,cell) + k_m, min(g,rhs)]
     */
    const calcKey = (cell) => {
      const mn = Math.min(getG(cell), getRhs(cell));
      return [mn + h(s_start, cell) + k_m, mn];
    };

    const cmpKeys = ([a0, a1], [b0, b1]) => (a0 !== b0 ? a0 - b0 : a1 - b1);

    /** Map from key string -> current key in heap (for membership test) */
    //const inQueue = new Map(); moved up

    const pq = new MinHeap((a, b) => cmpKeys(a.k, b.k));

    const queueInsert = (cell) => {
      const k = calcKey(cell);
      inQueue.set(key(cell), k);
      trackPeak();
      pq.push({ cell, k });
    };

    const queueRemove = (cell) => {
      inQueue.delete(key(cell));
      // Lazy deletion — stale entries are filtered when popped
    };

    const queuePop = () => {
      while (!pq.empty) {
        const top = pq.pop();
        const ck = key(top.cell);
        if (!inQueue.has(ck)) continue; // lazily deleted
        if (cmpKeys(inQueue.get(ck), top.k) !== 0) continue; // stale
        inQueue.delete(ck);
        return top;
      }
      return null;
    };

    const queueTop = () => {
      while (!pq.empty) {
        const top = pq.peek;
        const ck = key(top.cell);
        if (!inQueue.has(ck)) {
          pq.pop();
          continue;
        }
        if (cmpKeys(inQueue.get(ck), top.k) !== 0) {
          pq.pop();
          continue;
        }
        return top;
      }
      return null;
    };

    // ── Neighbours (predecessors/successors in backward search) ──

    const pred = (cell) => grid.neighbors(cell.r, cell.c, dirs8);
    const succ = (cell) => grid.neighbors(cell.r, cell.c, dirs8);

    // ── Update vertex procedure ────────────────────

    const updateVertex = (u) => {
      if (u.r !== s_goal.r || u.c !== s_goal.c) {
        // rhs(u) = min over successors s of (c(u,s) + g(s))
        const succs = succ(u);
        const minVal = succs.reduce((mn, s) => {
          const cost = grid.edgeCost(u, s) + getG(s);
          return cost < mn ? cost : mn;
        }, INF);
        setRhs(u, minVal);
      }
      queueRemove(u);
      if (getG(u) !== getRhs(u)) {
        queueInsert(u);
      }
    };

    // ── Initialise ────────────────────────────────

    setRhs(s_goal, 0);
    queueInsert(s_goal);

    // ── Compute shortest path ─────────────────────

    let nodesExpanded = 0;

    const computeShortestPath = function* () {
      let replanCount = 0;
      let replanNodes = 0;
      let isReplanning = false;

      while (true) {
        isReplanning = false;
        const topEntry = queueTop();
        if (!topEntry) break;

        const startKey_ = calcKey(s_start);
        const topKey = topEntry.k;

        // Termination: start is consistent and has lower/equal priority
        if (
          cmpKeys(topKey, startKey_) >= 0 &&
          getRhs(s_start) === getG(s_start)
        )
          break;

        const entry = queuePop();
        if (!entry) break;

        const u = entry.cell;
        nodesExpanded++;
        if (isReplanning) replanNodes++;

        const gu = getG(u);
        const rhsu = getRhs(u);

        if (gu > rhsu) {
          // Over-consistent: make consistent
          setG(u, rhsu);
          yield { type: "visit", r: u.r, c: u.c, cost: rhsu };
          for (const s of pred(u)) {
            updateVertex(s);
          }
        } else {
          // Under-consistent → raise, this branch fires during replanning
          if (!isReplanning) {
            isReplanning = true;
            replanCount++;
            yield { type: "replan", replanIndex: replanCount };
          }
          setG(u, INF);
          yield { type: "visit", r: u.r, c: u.c, cost: INF };
          updateVertex(u);
          for (const s of pred(u)) {
            updateVertex(s);
          }
        }
      }
      return nodesExpanded;
    };

    // Run the backward search
    for (const step of computeShortestPath()) {
      yield step;
    }

    // ── Extract path (greedy descent on g-values) ──

    if (getG(s_start) === INF) {
      yield {
        type: "done",
        success: false,
        path: [],
        nodesExpanded,
        pathCost: INF,
        peakMemoryBytes: this.estimateBytes(peakEntries),
      };
      return;
    }

    const path = [{ r: s_start.r, c: s_start.c }];
    let current = s_start;
    const maxSteps = grid.rows * grid.cols + 10;
    let steps = 0;

    while (
      !(current.r === s_goal.r && current.c === s_goal.c) &&
      steps++ < maxSteps
    ) {
      const succs = succ(current);
      if (succs.length === 0) break;

      // Step toward neighbour with lowest (edgeCost + g)
      let bestCell = null;
      let bestVal = INF;
      for (const s of succs) {
        const val = grid.edgeCost(current, s) + getG(s);
        if (val < bestVal) {
          bestVal = val;
          bestCell = s;
        }
      }

      if (!bestCell || bestVal >= INF) break;

      current = bestCell;
      path.push({ r: current.r, c: current.c });
      yield { type: "path", r: current.r, c: current.c };
    }

    const success = current.r === s_goal.r && current.c === s_goal.c;
    const pathCost = this.pathCost(path);

    yield {
      type: "done",
      success,
      path,
      nodesExpanded,
      pathCost,
      peakMemoryBytes: this.estimateBytes(peakEntries),
      replanCount, // ADD
      replanNodes, // ADD — nodes expanded during replans
    };
  }
}
