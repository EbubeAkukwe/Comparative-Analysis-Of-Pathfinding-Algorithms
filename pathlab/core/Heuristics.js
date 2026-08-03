/**
 * PathLab — Heuristics
 * Distance functions for informed search algorithms.
 *
 * All functions take two node-like objects with .r and .c
 * properties (row, column) and return a non-negative number.
 *
 * Admissibility:
 *   Manhattan  — admissible for 4-dir, inadmissible for 8-dir
 *   Euclidean  — admissible for both 4-dir and 8-dir
 *   Chebyshev  — admissible for 8-dir (diagonal cost = 1)
 *                inadmissible for 4-dir (overestimates)
 */

/**
 * Manhattan distance.
 * h(a,b) = |Δr| + |Δc|
 * Exact for 4-directional uniform-cost grids.
 * @param {{r:number,c:number}} a
 * @param {{r:number,c:number}} b
 * @returns {number}
 */
export function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/**
 * Euclidean distance.
 * h(a,b) = √(Δr² + Δc²)
 * Admissible for both movement modes.
 * @param {{r:number,c:number}} a
 * @param {{r:number,c:number}} b
 * @returns {number}
 */
export function euclidean(a, b) {
  const dr = a.r - b.r;
  const dc = a.c - b.c;
  return Math.sqrt(dr * dr + dc * dc);
}

/**
 * Chebyshev distance.
 * h(a,b) = max(|Δr|, |Δc|)
 * Exact for 8-directional grids where diagonal cost = 1.
 * @param {{r:number,c:number}} a
 * @param {{r:number,c:number}} b
 * @returns {number}
 */
export function chebyshev(a, b) {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
}

/**
 * Zero heuristic — degrades A* to Dijkstra.
 * Useful for testing and comparison baselines.
 * @returns {0}
 */
export function zero() { return 0; }

/**
 * Retrieve a heuristic function by name.
 * Falls back to manhattan if name is unrecognised.
 * @param {'manhattan'|'euclidean'|'chebyshev'|'zero'} name
 * @returns {Function}
 */
export function getHeuristic(name) {
  const map = { manhattan, euclidean, chebyshev, zero };
  return map[name] ?? manhattan;
}

/**
 * Heuristic metadata for UI display.
 */
export const HEURISTIC_META = {
  manhattan: {
    label:       'Manhattan',
    formula:     '|Δr| + |Δc|',
    admissible4: true,
    admissible8: false,
    description: 'Sum of horizontal and vertical distances. Exact for 4-directional movement.',
  },
  euclidean: {
    label:       'Euclidean',
    formula:     '√(Δr² + Δc²)',
    admissible4: true,
    admissible8: true,
    description: 'Straight-line distance. Admissible for both movement modes.',
  },
  chebyshev: {
    label:       'Chebyshev',
    formula:     'max(|Δr|, |Δc|)',
    admissible4: false,
    admissible8: true,
    description: 'Maximum axis distance. Exact for 8-directional uniform diagonal movement.',
  },
};
