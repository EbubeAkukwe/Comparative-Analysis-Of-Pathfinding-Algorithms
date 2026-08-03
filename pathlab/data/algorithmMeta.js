/**
 * PathLab — algorithmMeta
 * Descriptions, complexity data, and educational content for
 * the guide modal and UI tooltips.
 */

export const ALGO_META = {
  'BFS': {
    fullName:    'Breadth-First Search',
    tagline:     'Uniform expansion, optimal on unweighted graphs',
    description: `BFS explores all nodes at the current frontier distance before advancing. 
It uses a FIFO queue, guaranteeing the shortest path by edge count on unweighted graphs. 
It does not use a heuristic — it expands uniformly in all directions like a wave.`,
    bestFor:     'Unweighted grids, maze solving, finding shortest-hop paths.',
    timeComplexity:  'O(V + E)',
    spaceComplexity: 'O(V)',
    optimal:  true,
    complete: true,
    usesHeuristic: false,
    pseudocode: `
  queue ← [start]
  visited ← {start}
  while queue not empty:
    u ← queue.dequeue()
    if u == goal: return reconstruct(u)
    for v in neighbours(u):
      if v not in visited:
        visited.add(v)
        queue.enqueue(v)`,
  },

  'Dijkstra': {
    fullName:    "Dijkstra's Algorithm",
    tagline:     'Optimal weighted search, no heuristic required',
    description: `Dijkstra extends BFS to weighted graphs. It uses a min-heap priority queue 
ordered by cumulative cost g(n). At each step the lowest-cost frontier node is expanded. 
Equivalent to A* with h=0. Explores more of the graph but makes no assumptions about layout.`,
    bestFor:     'Weighted grids, road networks, any graph where edge costs vary.',
    timeComplexity:  'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    optimal:  true,
    complete: true,
    usesHeuristic: false,
    pseudocode: `
  pq ← MinHeap([(0, start)])
  dist[start] ← 0
  while pq not empty:
    d, u ← pq.pop()
    if d > dist[u]: continue
    if u == goal: return reconstruct(u)
    for v in neighbours(u):
      nd ← d + cost(u, v)
      if nd < dist[v]:
        dist[v] ← nd
        pq.push((nd, v))`,
  },

  'A*': {
    fullName:    'A* Search',
    tagline:     'Heuristic-guided optimal search — the gold standard',
    description: `A* combines g(n) (actual cost from start) with h(n) (estimated cost to goal), 
sorting the open set by f(n) = g(n) + h(n). With an admissible heuristic it finds the optimal 
path while expanding far fewer nodes than Dijkstra. It is the standard algorithm for 
game pathfinding and robotics navigation.`,
    bestFor:     'Grid navigation with a known goal. The go-to for most practical applications.',
    timeComplexity:  'O(b^d) best case',
    spaceComplexity: 'O(b^d)',
    optimal:  true,
    complete: true,
    usesHeuristic: true,
    pseudocode: `
  openSet ← MinHeap([start])  # ordered by f(n)
  g[start] ← 0
  f[start] ← h(start, goal)
  while openSet not empty:
    u ← openSet.pop()
    if u == goal: return reconstruct(u)
    for v in neighbours(u):
      tg ← g[u] + cost(u, v)
      if tg < g[v]:
        g[v] ← tg; f[v] ← tg + h(v, goal)
        openSet.push(v)`,
  },

  'Greedy BFS': {
    fullName:    'Greedy Best-First Search',
    tagline:     'Fast but suboptimal — follows the heuristic blindly',
    description: `Greedy BFS sorts the open set by h(n) alone — the estimated cost to goal — 
completely ignoring g(n). This makes it very fast at finding a path in open spaces, but 
it can be seriously misled by the heuristic, producing paths much longer than optimal. 
Unlike A*, it offers no optimality guarantee.`,
    bestFor:     'Situations where reaching the goal quickly matters more than path quality.',
    timeComplexity:  'O(b^m) worst case',
    spaceComplexity: 'O(b^m)',
    optimal:  false,
    complete: true,
    usesHeuristic: true,
    pseudocode: `
  openSet ← MinHeap([start])  # ordered by h(n) only
  visited ← {start}
  while openSet not empty:
    u ← openSet.pop()
    if u == goal: return reconstruct(u)
    for v in neighbours(u):
      if v not in visited:
        visited.add(v)
        openSet.push(v)  # key = h(v, goal)`,
  },

  'D* Lite': {
    fullName:    'D* Lite',
    tagline:     'Incremental replanning for dynamic environments',
    description: `D* Lite (Koenig & Likhachev, 2002) plans backwards from goal to start and 
maintains a consistent heuristic under edge-cost changes. When an obstacle appears, 
only nodes affected by the change are updated — not the entire graph. This makes it 
far more efficient than full replanning for real-time robotics and games.`,
    bestFor:     'Dynamic environments where obstacles change after planning begins.',
    timeComplexity:  'O(k log k) per replan (k changed edges)',
    spaceComplexity: 'O(V)',
    optimal:  true,
    complete: true,
    usesHeuristic: true,
    pseudocode: `
  # Backward search from goal to start
  rhs[goal] ← 0; enqueue(goal)
  while queue not empty and start inconsistent:
    u ← queue.pop()
    if g[u] > rhs[u]:
      g[u] ← rhs[u]
      update predecessors
    else:
      g[u] ← INF
      update u and predecessors
  # Extract path: greedy descent on g-values`,
  },
};

export const HEURISTIC_META = {
  manhattan: {
    label:       'Manhattan',
    formula:     '|Δr| + |Δc|',
    admissible4: true,
    admissible8: false,
    description: `The sum of the absolute row and column differences. 
On a 4-directional grid with uniform costs this is the exact distance — 
making it perfectly admissible and giving A* the best possible guidance. 
On an 8-directional grid it overestimates (diagonal moves cover more ground 
per step) which violates admissibility.`,
    tip: 'Use with 4-direction movement for optimal A* performance.',
  },
  euclidean: {
    label:       'Euclidean',
    formula:     '√(Δr² + Δc²)',
    admissible4: true,
    admissible8: true,
    description: `Straight-line ("as the crow flies") distance. Always admissible 
because any path must be at least as long as a straight line. Works correctly for 
both movement modes, but slightly underestimates on 4-dir grids (straight-line is 
shorter than taxicab), so A* expands slightly more nodes than with Manhattan.`,
    tip: 'Use with 8-direction movement for the most accurate estimate.',
  },
  chebyshev: {
    label:       'Chebyshev',
    formula:     'max(|Δr|, |Δc|)',
    admissible4: false,
    admissible8: true,
    description: `The maximum of the row and column differences — equivalent to 
chess king movement distance. Exactly admissible for 8-directional grids where 
diagonal cost equals 1, because a king can always move diagonally to close 
the larger axis. On 4-directional grids it overestimates by allowing "free" 
diagonals that don't exist.`,
    tip: 'Use with 8-direction movement. Produces very tight estimates for chess-king movement.',
  },
};

export const COMPLEXITY_TABLE = [
  { name: 'BFS',        time: 'O(V + E)',         space: 'O(V)',    optimal: '✓ (unweighted)', complete: '✓' },
  { name: 'Dijkstra',   time: 'O((V+E) log V)',   space: 'O(V)',    optimal: '✓',              complete: '✓' },
  { name: 'A*',         time: 'O(b^d) best',      space: 'O(b^d)', optimal: '✓ (admissible h)',complete: '✓' },
  { name: 'Greedy BFS', time: 'O(b^m) worst',     space: 'O(b^m)', optimal: '✗',              complete: '✓' },
  { name: 'D* Lite',    time: 'O(k log k) replan',space: 'O(V)',    optimal: '✓',              complete: '✓' },
];
