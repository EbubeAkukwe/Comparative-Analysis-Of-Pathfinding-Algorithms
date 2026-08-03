"""
PathLab — D* Lite
Python reference implementation matching the JS version.
Koenig & Likhachev, 2002.

Plans backward from goal to start. Supports efficient replanning
when edge costs change (obstacles added/removed).
"""
import heapq
import math

DIRS_4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIRS_8 = [(-1,-1),(-1, 0),(-1, 1),
          ( 0,-1),         ( 0, 1),
          ( 1,-1),( 1, 0),( 1, 1)]

INF = math.inf


def manhattan(a, b)  -> float: return abs(a[0]-b[0]) + abs(a[1]-b[1])
def euclidean(a, b)  -> float: return math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2)
def chebyshev(a, b)  -> float: return max(abs(a[0]-b[0]), abs(a[1]-b[1]))
HEURISTICS = {"manhattan": manhattan, "euclidean": euclidean, "chebyshev": chebyshev}


def edge_cost(r0, c0, r1, c1) -> float:
    return math.sqrt(2) if abs(r1-r0)+abs(c1-c0) > 1 else 1.0


class DStarLite:
    """
    D* Lite planner.
    Supports dynamic replanning via update_obstacle().
    """

    def __init__(self,
                 grid:      list[list[int]],
                 start:     tuple[int, int],
                 goal:      tuple[int, int],
                 heuristic: str  = "manhattan",
                 dirs8:     bool = False):
        self.grid  = [row[:] for row in grid]   # deep copy
        self.start = start
        self.goal  = goal
        self.h     = HEURISTICS.get(heuristic, manhattan)
        self.moves = DIRS_8 if dirs8 else DIRS_4
        self.rows  = len(grid)
        self.cols  = len(grid[0])

        self.g   = {}   # g[node]   = cost estimate to goal
        self.rhs = {}   # rhs[node] = one-step lookahead to goal
        self.k_m = 0    # key modifier (for moving start)

        # Priority queue: list of [key, node]
        self._pq = []
        self._in_queue = {}   # node -> key currently in queue

        # Initialise
        self.rhs[goal] = 0.0
        self._insert(goal)

    # ── Public API ──────────────────────────────────────────────────

    def plan(self) -> tuple[list | None, dict]:
        """
        Run the backward search and extract a path.

        Returns:
            (path, stats)
        """
        nodes_expanded = self._compute_shortest_path()
        path           = self._extract_path()
        cost           = _path_cost(path) if path else INF

        return path, {
            "nodes_expanded": nodes_expanded,
            "path_cost":  cost,
            "path_length": len(path) if path else 0,
        }

    def update_obstacle(self, r: int, c: int, is_wall: bool):
        """
        Mark (r,c) as wall / open and trigger an incremental replan.
        Call plan() again after this to get the updated path.
        """
        self.grid[r][c] = 1 if is_wall else 0
        node = (r, c)
        # Re-evaluate all neighbours whose rhs might change
        for dr, dc in self.moves:
            nb = (r + dr, c + dc)
            if self._in_bounds(nb):
                self._update_vertex(nb)
        self._update_vertex(node)

    # ── D* Lite internals ────────────────────────────────────────────

    def _key(self, node):
        g_n   = self.g.get(node,   INF)
        rhs_n = self.rhs.get(node, INF)
        mn    = min(g_n, rhs_n)
        return (mn + self.h(self.start, node) + self.k_m, mn)

    def _insert(self, node):
        k = self._key(node)
        self._in_queue[node] = k
        heapq.heappush(self._pq, (k, node))

    def _remove(self, node):
        self._in_queue.pop(node, None)
        # Lazy deletion — stale entries ignored on pop

    def _top(self):
        while self._pq:
            k, node = self._pq[0]
            if node not in self._in_queue:
                heapq.heappop(self._pq); continue
            if self._in_queue[node] != k:
                heapq.heappop(self._pq); continue
            return k, node
        return None, None

    def _pop(self):
        while self._pq:
            k, node = heapq.heappop(self._pq)
            if node not in self._in_queue:     continue
            if self._in_queue[node] != k:      continue
            del self._in_queue[node]
            return k, node
        return None, None

    def _successors(self, node):
        r, c = node
        result = []
        for dr, dc in self.moves:
            nr, nc = r + dr, c + dc
            if self._in_bounds((nr, nc)) and self.grid[nr][nc] == 0:
                result.append((nr, nc))
        return result

    def _predecessors(self, node):
        return self._successors(node)   # symmetric grid

    def _in_bounds(self, node):
        r, c = node
        return 0 <= r < self.rows and 0 <= c < self.cols

    def _c(self, u, v):
        """Edge cost between adjacent open cells; INF if either is a wall."""
        r0, c0 = u; r1, c1 = v
        if self.grid[r0][c0] == 1 or self.grid[r1][c1] == 1:
            return INF
        return edge_cost(r0, c0, r1, c1)

    def _update_vertex(self, u):
        if u != self.goal:
            succs = self._successors(u)
            if succs:
                self.rhs[u] = min(self._c(u, s) + self.g.get(s, INF) for s in succs)
            else:
                self.rhs[u] = INF
        self._remove(u)
        if self.g.get(u, INF) != self.rhs.get(u, INF):
            self._insert(u)

    def _compute_shortest_path(self) -> int:
        nodes_expanded = 0
        while True:
            top_k, u = self._top()
            if top_k is None:
                break
            start_key = self._key(self.start)
            rhs_s = self.rhs.get(self.start, INF)
            g_s   = self.g.get(self.start,   INF)
            if top_k >= start_key and rhs_s == g_s:
                break

            _, u = self._pop()
            if u is None:
                break
            nodes_expanded += 1

            g_u   = self.g.get(u,   INF)
            rhs_u = self.rhs.get(u, INF)

            if g_u > rhs_u:
                # Over-consistent
                self.g[u] = rhs_u
                for s in self._predecessors(u):
                    self._update_vertex(s)
            else:
                # Under-consistent
                self.g[u] = INF
                self._update_vertex(u)
                for s in self._predecessors(u):
                    self._update_vertex(s)

        return nodes_expanded

    def _extract_path(self) -> list | None:
        """Greedy gradient descent from start along g-values."""
        if self.g.get(self.start, INF) == INF:
            return None   # no path
        path    = [self.start]
        current = self.start
        max_steps = self.rows * self.cols + 10

        for _ in range(max_steps):
            if current == self.goal:
                break
            succs = self._successors(current)
            if not succs:
                return None
            current = min(succs, key=lambda s: self._c(current, s) + self.g.get(s, INF))
            if self._c(path[-1], current) + self.g.get(current, INF) >= INF:
                return None
            path.append(current)
        else:
            return None

        return path if path[-1] == self.goal else None


def _path_cost(path) -> float:
    cost = 0.0
    for i in range(1, len(path)):
        r0, c0 = path[i-1]; r1, c1 = path[i]
        cost += math.sqrt(2) if abs(r1-r0)+abs(c1-c0) > 1 else 1.0
    return cost


# ── Convenience wrapper ────────────────────────────────────────────

def dstar_lite(grid, start, goal, heuristic="manhattan", dirs8=False):
    """One-shot wrapper: plan and return (path, stats)."""
    planner = DStarLite(grid, start, goal, heuristic=heuristic, dirs8=dirs8)
    return planner.plan()


if __name__ == "__main__":
    G = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 0],
    ]

    # Initial plan
    planner = DStarLite(G, (0, 0), (4, 6))
    path, stats = planner.plan()
    print("D* Lite initial path:", path)
    print("Stats:               ", stats)

    # Simulate dynamic obstacle and replan
    planner.update_obstacle(3, 2, is_wall=True)
    path2, stats2 = planner.plan()
    print("\nAfter obstacle at (3,2):")
    print("D* Lite replan path:", path2)
    print("Stats:              ", stats2)
