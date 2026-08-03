# PathLab — Pathfinding Algorithm Research Platform

An interactive web platform for visualizing and comparing pathfinding algorithms side-by-side.  
Built to accompany a computer science research project. Suitable for researchers, students, and recruiters.

---

## Live features

| Feature | Detail |
|---|---|
| **Algorithms** | BFS, Dijkstra, A\*, Greedy BFS, D\* Lite |
| **Movement** | 4-directional or 8-directional |
| **Heuristics** | Manhattan, Euclidean, Chebyshev |
| **Visualization** | Animated node expansion, heatmap overlay, path drawing |
| **Comparison** | Side-by-side runtime, nodes expanded, path cost, success rate |
| **Dynamic env** | Place obstacles during a run; D\* Lite replans incrementally |
| **Terrain** | Interactive wall painting, maze generator (DFS backtracker), scatter |
| **Educational** | Tabbed guide: algorithm descriptions, pseudocode, complexity table, usage tips |
| **Step mode** | Advance algorithms one node at a time |
| **Keyboard shortcuts** | Full keyboard control (see guide modal) |
| **Mobile** | Touch-first canvas, responsive layout |

---

## Project structure

```
pathfinding-lab/
├── index.html                   Entry point — full shell layout
├── main.js                      Bootstrap — wires all modules together
│
├── style/
│   ├── tokens.css               CSS custom properties (colors, spacing, type)
│   ├── layout.css               Three-column app shell, panel layout
│   ├── components.css           Buttons, selects, toggles, tool buttons, sliders
│   ├── dashboard.css            Metric cards, comparison table, bar charts
│   ├── modal.css                Educational modal overlay, tabbed interface
│   └── responsive.css           Mobile breakpoints, touch adjustments
│
├── core/
│   ├── EventBus.js              Pub/sub decoupling layer (all cross-module events)
│   ├── Grid.js                  Grid state model — nodes, walls, start/goal, maze gen
│   ├── Heuristics.js            Manhattan, Euclidean, Chebyshev distance functions
│   ├── MinHeap.js               Binary min-heap priority queue
│   ├── Renderer.js              Layered canvas engine (static / dynamic / overlay)
│   ├── AlgorithmRunner.js       Generator step loop, RAF animation, dynamic mode
│   ├── BenchmarkEngine.js       Synchronous metric collection
│   └── StateManager.js          Central app state + mutation helpers
│
├── algorithms/
│   ├── AlgorithmBase.js         Abstract base class — generator interface contract
│   ├── BFS.js                   Breadth-First Search
│   ├── Dijkstra.js              Dijkstra's Algorithm
│   ├── AStar.js                 A* Search
│   ├── GreedyBFS.js             Greedy Best-First Search
│   └── DStarLite.js             D* Lite (incremental replanning)
│
├── plugins/
│   └── PluginRegistry.js        Algorithm registry + runtime extension API
│
├── ui/
│   ├── AlgoPanel.js             Left panel: algorithm list, tools, settings
│   ├── GridController.js        Mouse/touch interaction on canvas
│   ├── Dashboard.js             Right panel: metrics, comparison, charts
│   ├── EducationalModal.js      Tabbed guide modal
│   ├── StatusBar.js             Footer status strip + header live counter
│   └── RunLog.js                Live timestamped log strip
│
├── data/
│   └── algorithmMeta.js         Descriptions, pseudocode, complexity strings
│
└── python/                      Reference implementations (match JS algorithms exactly)
    ├── bfs.py
    ├── dijkstra.py
    ├── astar.py
    ├── greedy_bfs.py
    └── dstar_lite.py
```

---

## Running locally

PathLab uses ES modules — it must be served from a local HTTP server (not opened directly as a file).

### Option 1 — Python (built-in)
```bash
cd pathfinding-lab
python3 -m http.server 8080
# open http://localhost:8080
```

### Option 2 — Node.js `serve`
```bash
npx serve .
```

### Option 3 — VS Code Live Server
Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

---

## Architecture decisions

### Generator-based algorithms
Every algorithm's `solve()` method is a JavaScript generator function. The `AlgorithmRunner` pulls one step at a time, controlling animation speed independently of the algorithm logic. This means:
- Algorithm code contains zero UI concerns
- Speed is controlled entirely by the runner's `setTimeout` / `rAF` loop
- Step mode is free — just call `gen.next()` once

### Three-layer canvas
Three `<canvas>` elements are stacked at the same position via CSS:
1. **Static** — grid lines, walls, start/goal. Redrawn only on structural changes.
2. **Dynamic** — visited nodes, path lines, heatmap. Cleared per run.
3. **Overlay** — cursor highlight. Redrawn on every mouse move.

This prevents full-grid redraws during interaction and keeps the cursor responsive even during heavy animation.

### EventBus decoupling
All cross-module communication goes through the `EventBus` pub/sub. Algorithm code never imports UI modules; UI modules never import algorithm code. The only shared imports are `EventBus`, `StateManager`, and `PluginRegistry`.

### Plugin system
New algorithms can be added at runtime:
```js
import { PluginRegistry } from './plugins/PluginRegistry.js';
import { AlgorithmBase }  from './algorithms/AlgorithmBase.js';

class MyAlgo extends AlgorithmBase {
  *solve() {
    // ... yield { type:'visit', r, c, cost }
    // ... yield { type:'path', r, c }
    // ... yield { type:'done', success, path, nodesExpanded, pathCost }
  }
}

PluginRegistry.register('My Algorithm', {
  cls:       MyAlgo,
  color:     '#FF6B6B',
  shortName: 'MyAlgo',
  supportsH: true,
});
```
The algorithm will automatically appear in the checklist, comparison table, and bar charts.

---

## Python modules

The `python/` directory contains clean, self-contained implementations matching the JS algorithms exactly. Each file:
- Has no external dependencies beyond the standard library
- Accepts a 2-D grid (`0` = open, `1` = wall) and returns `(path, stats)`
- Can be run directly: `python3 python/astar.py`

The `DStarLite` Python class additionally exposes `update_obstacle(r, c, is_wall)` for incremental replanning demonstrations.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `R` | Run / Pause |
| `Space` | Step once |
| `Esc` | Reset visualization |
| `W` | Wall tool |
| `E` | Erase tool |
| `S` | Set start |
| `G` | Set goal |
| `M` | Generate maze |
| `?` | Open guide |
| `Shift+Delete` | Clear all |

---

## Algorithms at a glance

| Algorithm | Optimal | Uses h | Time | Space |
|---|---|---|---|---|
| BFS | ✓ (unweighted) | No | O(V+E) | O(V) |
| Dijkstra | ✓ | No | O((V+E)logV) | O(V) |
| A\* | ✓ (admissible h) | Yes | O(b^d) best | O(b^d) |
| Greedy BFS | ✗ | Yes | O(b^m) worst | O(b^m) |
| D\* Lite | ✓ | Yes | O(k log k) replan | O(V) |

---

## License

MIT — free to use for academic, educational, and personal projects.  
Attribution appreciated: *PathLab by Ebube Akukwe Jude, 2026.*
