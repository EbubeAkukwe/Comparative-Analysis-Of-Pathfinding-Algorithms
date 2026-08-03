"""
PathLab — A* Search
Python reference implementation matching the JS version.
"""
import heapq
import math

DIRS_4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIRS_8 = [(-1,-1),(-1, 0),(-1, 1),
          ( 0,-1),         ( 0, 1),
          ( 1,-1),( 1, 0),( 1, 1)]


# ── Heuristics ─────────────────────────────────────────────────────

def manhattan(a, b) -> float:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])

def euclidean(a, b) -> float:
    return math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2)

def chebyshev(a, b) -> float:
    return max(abs(a[0]-b[0]), abs(a[1]-b[1]))

HEURISTICS = {"manhattan": manhattan, "euclidean": euclidean, "chebyshev": chebyshev}


def edge_cost(r0, c0, r1, c1) -> float:
    return math.sqrt(2) if abs(r1 - r0) + abs(c1 - c0) > 1 else 1.0


def astar(grid: list[list[int]],
          start: tuple[int, int],
          goal:  tuple[int, int],
          heuristic: str = "manhattan",
          dirs8:     bool = False) -> tuple[list | None, dict]:
    """
    A* Search.

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

    g_score   = {start: 0.0}
    came_from = {start: None}
    closed    = set()

    # (f, g, node) — include g as tiebreaker
    pq = [(h(start, goal), 0.0, start)]
    nodes_expanded = 0

    while pq:
        f, g, current = heapq.heappop(pq)

        if current in closed:
            continue
        closed.add(current)
        nodes_expanded += 1

        if current == goal:
            path = _reconstruct(came_from, goal)
            return path, {
                "nodes_expanded": nodes_expanded,
                "path_cost":  g,
                "path_length": len(path),
            }

        r, c = current
        for dr, dc in moves:
            nr, nc = r + dr, c + dc
            nb = (nr, nc)
            if not (0 <= nr < rows and 0 <= nc < cols): continue
            if grid[nr][nc] == 1: continue
            if nb in closed: continue

            tentative_g = g + edge_cost(r, c, nr, nc)
            if tentative_g < g_score.get(nb, math.inf):
                g_score[nb]   = tentative_g
                came_from[nb] = current
                f_new = tentative_g + h(nb, goal)
                heapq.heappush(pq, (f_new, tentative_g, nb))

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


if __name__ == "__main__":
    G = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 0],
    ]
    for h_name in ("manhattan", "euclidean", "chebyshev"):
        path, stats = astar(G, (0, 0), (4, 6), heuristic=h_name)
        print(f"A* ({h_name:10}): cost={stats['path_cost']:.2f}  nodes={stats['nodes_expanded']}")
