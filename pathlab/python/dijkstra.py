"""
PathLab — Dijkstra's Algorithm
Python reference implementation matching the JS version.
"""
import heapq
import math

DIRS_4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIRS_8 = [(-1,-1),(-1, 0),(-1, 1),
          ( 0,-1),         ( 0, 1),
          ( 1,-1),( 1, 0),( 1, 1)]


def edge_cost(r0, c0, r1, c1) -> float:
    return math.sqrt(2) if abs(r1 - r0) + abs(c1 - c0) > 1 else 1.0


def dijkstra(grid: list[list[int]],
             start: tuple[int, int],
             goal:  tuple[int, int],
             dirs8: bool = False) -> tuple[list | None, dict]:
    """
    Dijkstra's Algorithm.

    Args:
        grid:  2-D list (0 = open, 1 = wall).
        start: (row, col).
        goal:  (row, col).
        dirs8: 8-directional movement if True.

    Returns:
        (path, stats)
    """
    rows, cols = len(grid), len(grid[0])
    moves = DIRS_8 if dirs8 else DIRS_4

    dist      = {start: 0.0}
    came_from = {start: None}
    closed    = set()

    # (cost, row, col)
    pq = [(0.0, start)]
    nodes_expanded = 0

    while pq:
        d, current = heapq.heappop(pq)
        if current in closed:
            continue
        closed.add(current)

        if d > dist.get(current, math.inf):
            continue

        nodes_expanded += 1

        if current == goal:
            path = _reconstruct(came_from, goal)
            return path, {
                "nodes_expanded": nodes_expanded,
                "path_cost":  d,
                "path_length": len(path),
            }

        r, c = current
        for dr, dc in moves:
            nr, nc = r + dr, c + dc
            nb = (nr, nc)
            if not (0 <= nr < rows and 0 <= nc < cols): continue
            if grid[nr][nc] == 1: continue
            if nb in closed: continue

            new_d = d + edge_cost(r, c, nr, nc)
            if new_d < dist.get(nb, math.inf):
                dist[nb]      = new_d
                came_from[nb] = current
                heapq.heappush(pq, (new_d, nb))

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
    path, stats = dijkstra(G, (0, 0), (4, 6))
    print("Dijkstra path:", path)
    print("Stats:        ", stats)
