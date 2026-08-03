"""
PathLab — Greedy Best-First Search
Python reference implementation matching the JS version.
"""
import heapq
import math

DIRS_4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIRS_8 = [(-1,-1),(-1, 0),(-1, 1),
          ( 0,-1),         ( 0, 1),
          ( 1,-1),( 1, 0),( 1, 1)]


def manhattan(a, b)  -> float: return abs(a[0]-b[0]) + abs(a[1]-b[1])
def euclidean(a, b)  -> float: return math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2)
def chebyshev(a, b)  -> float: return max(abs(a[0]-b[0]), abs(a[1]-b[1]))

HEURISTICS = {"manhattan": manhattan, "euclidean": euclidean, "chebyshev": chebyshev}


def edge_cost(r0, c0, r1, c1) -> float:
    return math.sqrt(2) if abs(r1 - r0) + abs(c1 - c0) > 1 else 1.0


def greedy_bfs(grid: list[list[int]],
               start: tuple[int, int],
               goal:  tuple[int, int],
               heuristic: str = "manhattan",
               dirs8:     bool = False) -> tuple[list | None, dict]:
    """
    Greedy Best-First Search.

    Sorts open set by h(n) only — does NOT track g(n).
    Fast but not guaranteed to find the optimal path.

    Args:
        grid:      2-D list (0 = open, 1 = wall).
        start:     (row, col).
        goal:      (row, col).
        heuristic: 'manhattan' | 'euclidean' | 'chebyshev'.
        dirs8:     8-directional movement if True.

    Returns:
        (path, stats)
    """
    rows, cols = len(grid), len(grid[0])
    moves = DIRS_8 if dirs8 else DIRS_4
    h     = HEURISTICS.get(heuristic, manhattan)

    visited   = {start}
    came_from = {start: None}

    # (h_val, node)
    pq = [(h(start, goal), start)]
    nodes_expanded = 0

    while pq:
        _, current = heapq.heappop(pq)
        nodes_expanded += 1

        if current == goal:
            path = _reconstruct(came_from, goal)
            cost = _path_cost(path, dirs8)
            return path, {
                "nodes_expanded": nodes_expanded,
                "path_cost":  cost,
                "path_length": len(path),
            }

        r, c = current
        for dr, dc in moves:
            nr, nc = r + dr, c + dc
            nb = (nr, nc)
            if not (0 <= nr < rows and 0 <= nc < cols): continue
            if grid[nr][nc] == 1: continue
            if nb in visited: continue

            visited.add(nb)
            came_from[nb] = current
            heapq.heappush(pq, (h(nb, goal), nb))

    return None, {
        "nodes_expanded": nodes_expanded,
        "path_cost": math.inf,
        "path_length": 0,
    }


def _reconstruct(came_from, current):
    path = []
    while current is not None:
        path.append(current)
        current = came_from[current]
    return path[::-1]


def _path_cost(path, diagonal=False) -> float:
    cost = 0.0
    for i in range(1, len(path)):
        r0, c0 = path[i-1]
        r1, c1 = path[i]
        cost += math.sqrt(2) if abs(r1-r0)+abs(c1-c0) > 1 else 1.0
    return cost


if __name__ == "__main__":
    G = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 0],
    ]
    path, stats = greedy_bfs(G, (0, 0), (4, 6), heuristic="manhattan")
    print("Greedy BFS path:", path)
    print("Stats:          ", stats)
    print("(Note: path may not be optimal)")
