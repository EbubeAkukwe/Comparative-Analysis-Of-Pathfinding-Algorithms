"""
PathLab — BFS (Breadth-First Search)
Python reference implementation matching the JS version.

Usage:
    grid  = [[0]*cols for _ in range(rows)]   # 0=open, 1=wall
    start = (0, 2)
    goal  = (0, cols-3)
    path, stats = bfs(grid, start, goal, dirs8=False)
"""
from collections import deque


DIRS_4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIRS_8 = [(-1,-1),(-1, 0),(-1, 1),
          ( 0,-1),         ( 0, 1),
          ( 1,-1),( 1, 0),( 1, 1)]


def bfs(grid: list[list[int]],
        start: tuple[int, int],
        goal:  tuple[int, int],
        dirs8: bool = False) -> tuple[list | None, dict]:
    """
    Breadth-First Search.

    Args:
        grid:  2-D list of ints (0 = open, 1 = wall).
        start: (row, col) start position.
        goal:  (row, col) goal position.
        dirs8: If True, allow 8-directional movement.

    Returns:
        (path, stats)
        path  — list of (row, col) from start to goal, or None if no path.
        stats — dict with keys: nodes_expanded, path_cost, path_length.
    """
    rows, cols = len(grid), len(grid[0])
    moves = DIRS_8 if dirs8 else DIRS_4

    if grid[start[0]][start[1]] == 1 or grid[goal[0]][goal[1]] == 1:
        return None, {"nodes_expanded": 0, "path_cost": float("inf"), "path_length": 0}

    queue     = deque([start])
    visited   = {start}
    came_from = {start: None}
    nodes_expanded = 0

    while queue:
        current = queue.popleft()
        nodes_expanded += 1

        if current == goal:
            path = _reconstruct(came_from, goal)
            cost = _path_cost(path, diagonal=dirs8)
            return path, {
                "nodes_expanded": nodes_expanded,
                "path_cost":  cost,
                "path_length": len(path),
            }

        r, c = current
        for dr, dc in moves:
            nr, nc = r + dr, c + dc
            nb = (nr, nc)
            if 0 <= nr < rows and 0 <= nc < cols and nb not in visited and grid[nr][nc] == 0:
                visited.add(nb)
                came_from[nb] = current
                queue.append(nb)

    return None, {
        "nodes_expanded": nodes_expanded,
        "path_cost": float("inf"),
        "path_length": 0,
    }


# ── Shared helpers ─────────────────────────────────────────────────

def _reconstruct(came_from: dict, current) -> list:
    path = []
    while current is not None:
        path.append(current)
        current = came_from[current]
    return path[::-1]


def _path_cost(path: list, diagonal: bool = False) -> float:
    import math
    cost = 0.0
    for i in range(1, len(path)):
        r0, c0 = path[i - 1]
        r1, c1 = path[i]
        cost += math.sqrt(2) if abs(r1 - r0) + abs(c1 - c0) > 1 else 1.0
    return cost


# ── CLI demo ───────────────────────────────────────────────────────

if __name__ == "__main__":
    G = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 1, 0],
        [0, 0, 0, 1, 0, 1, 0],
        [0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1, 0],
    ]
    path, stats = bfs(G, (0, 0), (4, 6))
    print("BFS path:", path)
    print("Stats:   ", stats)
