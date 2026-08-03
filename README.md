# Comparative Analysis of Pathfinding Algorithms

> **A Comparative Analysis of Pathfinding Algorithms Under Different Movement Models, Heuristic Functions, and Environmental Complexities**
>
> *Undergraduate Computer Science Research Project*

---

## Overview

Pathfinding is a fundamental problem in computer science, robotics, artificial intelligence, and game development. Numerous algorithms have been proposed over the years, each with different strengths depending on the environment in which they operate.

This project provides a comprehensive experimental comparison of several classical pathfinding algorithms under varying experimental conditions to determine how algorithm choice, movement model, heuristic function, and obstacle density affect navigation performance.

Unlike many comparative studies that evaluate only execution time or path cost, this research investigates multiple performance metrics to provide a more complete understanding of algorithm behavior.

---

## Research Objectives

This study investigates the following research questions:

- Which algorithm consistently produces the shortest path?
- How do movement models affect algorithm efficiency?
- Which heuristic provides the best trade-off between speed and path optimality?
- How does environmental complexity (obstacle density) affect algorithm performance?
- Are there relationships between an algorithm's performance and the choice of heuristic, movement model, or environment?

---

## Algorithms Evaluated

- Breadth-First Search (**BFS**)
- **Dijkstra's Algorithm**
- **A\*** Search
-**D\* Lite**

---

## Movement Models

The experiments evaluate multiple movement constraints:

### 4-Directional Movement

- Up
- Down
- Left
- Right

### 8-Directional Movement

- Includes diagonal movement (Limitation: Diagonal cost is same as the cost of cardinal movement)

---

## Heuristic Functions

For **A\***, the following heuristic strategies are compared:

- Manhattan Distance
- Euclidean Distance
- Chebyshev Distance

---

## Experimental Variables

The experiments vary several environmental factors.

### Independent Variables

- Pathfinding algorithm
- Movement model
- Heuristic function
- Grid size
- Obstacle density
- Random environment generation

### Dependent Variables

- Path length
- Nodes expanded
- Execution time
- Memory usage
- Path optimality ratio
- Success rate

---

## Experimental Design

Each algorithm is evaluated over hundreds of randomly generated grid environments.

For every configuration:

- Identical start and end positions are used.
- Identical obstacle layouts are generated.
- Multiple repetitions are performed.
- Statistical summaries are calculated.

The collected results are analyzed using descriptive and inferential statistical methods.


## Technologies Used

- Python
- NumPy
- Pandas
- Matplotlib
- SciPy
- Jupyter Notebook

---

## Performance Metrics

The following metrics are collected for every experiment.

| Metric | Description |
|---------|-------------|
| **Path Length** | Total distance travelled |
| **Execution Time** | Runtime of the algorithm |
| **Nodes Expanded** | Search effort required |
| **Memory Usage** | Memory consumed during execution |
| **Success Rate** | Percentage of successful searches |
| **Optimality Ratio** | Obtained path relative to the optimal path |

---

## Statistical Analysis

The study includes:

- Descriptive statistics
- Mean
- Standard deviation
- Confidence intervals
- One-way ANOVA
- Tukey HSD post-hoc tests
- Effect size (η²)

---

## Example Visualizations

The repository includes plots such as:

- Execution Time vs. Obstacle Density
- Nodes Expanded Comparison
- Path Length Comparison
- Heuristic Performance Comparison
- Movement Model Comparison

---


## Clone the repository

```bash
git clone https://github.com/EbubeAkukwe/Comparative-Analysis-Of-Pathfinding-Algorithms.git
```

## Run pathlab to simulate pathfinding algorithms yourself

```bash
cd pathlab

python3 server.py
```
To know how to use the platform and also add custom algorithms, refer to the full instructions in the README.md

## Run the notebooks to see calculations and viz

```bash
cd "Data Analytics"

pip install -r requirements.txt
```
To use virtual environments refer to the full instructions in the README.md

---

## Citation

If you use this repository in academic work, please cite:

```text
Ebube A.J (2026).

Comparative Analysis of Pathfinding Algorithms Under Different
Movement Models and Heuristic Functions in Static Environments.

Undergraduate Research Project,
Imo State University,
Department of Computer Science.
```

---

## License

This project is released under the **MIT License**.
