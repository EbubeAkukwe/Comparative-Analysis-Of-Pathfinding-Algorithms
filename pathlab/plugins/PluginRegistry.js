/**
 * PathLab — PluginRegistry
 * Central registry of all pathfinding algorithms.
 * New algorithms can be registered at runtime via register().
 *
 * Each entry is a PluginEntry:
 *   {
 *     cls:        class extending AlgorithmBase,
 *     color:      hex string for canvas / legend,
 *     shortName:  ≤8 char abbreviation for table columns,
 *     supportsH:  boolean — does it use a heuristic?
 *   }
 */
import { BFS }       from '../algorithms/BFS.js';
import { Dijkstra }  from '../algorithms/Dijkstra.js';
import { AStar }     from '../algorithms/AStar.js';
import { GreedyBFS } from '../algorithms/GreedyBFS.js';
import { DStarLite } from '../algorithms/DStarLite.js';

/**
 * @typedef {Object} PluginEntry
 * @property {Function} cls        — class constructor (extends AlgorithmBase)
 * @property {string}   color      — hex color for this algorithm
 * @property {string}   shortName  — abbreviated name for UI
 * @property {boolean}  supportsH  — uses a heuristic function
 */

class _PluginRegistry {
  constructor() {
    /** @type {Map<string, PluginEntry>} */
    this._algorithms = new Map();
    this._registerDefaults();
  }

  _registerDefaults() {
    this.register('BFS', {
      cls:       BFS,
      color:     '#4B7FFF',
      shortName: 'BFS',
      supportsH: false,
    });

    this.register('Dijkstra', {
      cls:       Dijkstra,
      color:     '#34D188',
      shortName: 'Dijkstra',
      supportsH: false,
    });

    this.register('A*', {
      cls:       AStar,
      color:     '#F4A832',
      shortName: 'A*',
      supportsH: true,
    });

    this.register('Greedy BFS', {
      cls:       GreedyBFS,
      color:     '#9B77FF',
      shortName: 'Greedy',
      supportsH: true,
    });

    this.register('D* Lite', {
      cls:       DStarLite,
      color:     '#26D4B8',
      shortName: 'D* Lite',
      supportsH: true,
    });
  }

  /**
   * Register a new algorithm. Overwrites existing entry with same name.
   * @param {string}      name
   * @param {PluginEntry} entry
   */
  register(name, entry) {
    if (typeof entry.cls !== 'function')
      throw new TypeError(`[PluginRegistry] "${name}": cls must be a constructor`);
    if (!entry.color)
      throw new TypeError(`[PluginRegistry] "${name}": color is required`);

    this._algorithms.set(name, {
      cls:       entry.cls,
      color:     entry.color,
      shortName: entry.shortName ?? name.slice(0, 8),
      supportsH: entry.supportsH ?? false,
    });
  }

  /**
   * Get a single algorithm entry.
   * @param {string} name
   * @returns {PluginEntry|undefined}
   */
  get(name) {
    return this._algorithms.get(name);
  }

  /**
   * All registered algorithms as an ordered Map.
   * @returns {Map<string, PluginEntry>}
   */
  getAll() {
    return this._algorithms;
  }

  /**
   * Names of all registered algorithms, in insertion order.
   * @returns {string[]}
   */
  names() {
    return Array.from(this._algorithms.keys());
  }

  /**
   * True if an algorithm with this name is registered.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._algorithms.has(name);
  }
}

/** Singleton registry instance exported for the whole app. */
export const PluginRegistry = new _PluginRegistry();
