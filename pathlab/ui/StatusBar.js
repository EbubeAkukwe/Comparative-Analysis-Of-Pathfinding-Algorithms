/**
 * PathLab — StatusBar & Header
 * StatusBar: footer strip showing cursor, state, tool, grid info.
 * Header: logo, live node counter, run-phase pill.
 */
import { EventBus } from '../core/EventBus.js';
import { State } from '../core/StateManager.js';

// ══════════════════════════════════════════════════
// StatusBar
// ══════════════════════════════════════════════════
export class StatusBar {
  constructor() {
    this._nodesThisRun  = 0;
    this._bindEvents();
  }

  _bindEvents() {
    EventBus.on('cursor:move', ({ r, c }) => {
      const el = document.getElementById('st-cursor');
      if (!el) return;
      el.textContent = (r >= 0 && c >= 0) ? `(${r}, ${c})` : '—';
    });

    EventBus.on('grid:changed', ({ r, c, nextState }) => {
      const el = document.getElementById('st-state');
      if (el) el.textContent = nextState;
    });

    EventBus.on('settings:changed', ({ key, value }) => {
      if (key === 'tool') {
        const el = document.getElementById('st-tool');
        if (el) el.textContent = value;
      }
    });

    EventBus.on('grid:resized', ({ rows, cols }) => {
      const el = document.getElementById('st-grid');
      if (el) el.textContent = `${rows}×${cols}`;
    });

    EventBus.on('run:start', () => {
      this._nodesThisRun = 0;
      this._setPhase('running');
    });

    EventBus.on('run:step', () => {
      this._nodesThisRun++;
    });

    EventBus.on('run:done', () => {
      this._setPhase('done');
    });

    EventBus.on('run:reset', () => {
      this._nodesThisRun = 0;
      this._setPhase('idle');
    });

    EventBus.on('action:clearAll', () => {
      this._nodesThisRun = 0;
      this._setPhase('idle');
    });
  }

  _setPhase(phase) {
    const el = document.getElementById('st-phase');
    if (el) el.textContent = phase;
  }
}

// ══════════════════════════════════════════════════
// Header
// ══════════════════════════════════════════════════
export class Header {
  constructor() {
    this._nodeCount = 0;
    this._runTimer  = null;
    this._startTime = 0;
    this._bindEvents();
  }

  _bindEvents() {
    EventBus.on('run:start', ({ algorithms }) => {
      this._nodeCount = 0;
      this._startTime = performance.now();
      this._setPill('running', `${algorithms.length} algo${algorithms.length > 1 ? 's' : ''}`);
      this._startCounter();
    });

    EventBus.on('run:step', () => {
      this._nodeCount++;
      this._updateCounter();
    });

    EventBus.on('run:result', () => {
      this._updateCounter();
    });

    EventBus.on('run:done', ({ results }) => {
      this._stopCounter();
      const allSuccess = results.every(r => r.success);
      this._setPill(allSuccess ? 'done' : 'error',
        allSuccess ? 'Done' : `${results.filter(r=>!r.success).length} no path`);
    });

    EventBus.on('run:reset', () => {
      this._stopCounter();
      this._nodeCount = 0;
      this._updateCounter();
      this._setPill('idle', 'Ready');
    });

    EventBus.on('action:clearAll', () => {
      this._stopCounter();
      this._nodeCount = 0;
      this._updateCounter();
      this._setPill('idle', 'Ready');
    });

    EventBus.on('grid:resized', ({ rows, cols }) => {
      const el = document.getElementById('header-grid-info');
      if (el) el.textContent = `${rows}×${cols}`;
    });
  }

  _setPill(state, text) {
    const pill = document.getElementById('run-pill');
    if (!pill) return;
    pill.className = `status-pill ${state}`;
    const dot = pill.querySelector('.pill-dot');
    if (dot) {
      dot.classList.toggle('pulse', state === 'running');
    }
    const label = pill.querySelector('.pill-label');
    if (label) label.textContent = text;
  }

  _startCounter() {
    const el = document.getElementById('header-node-counter');
    if (!el) return;
    el.style.opacity = '1';
    // RAF loop for smooth counter
    const tick = () => {
      this._updateCounter();
      if (State.phase === 'running') {
        this._runTimer = requestAnimationFrame(tick);
      }
    };
    this._runTimer = requestAnimationFrame(tick);
  }

  _stopCounter() {
    if (this._runTimer) {
      cancelAnimationFrame(this._runTimer);
      this._runTimer = null;
    }
    this._updateCounter();
  }

  _updateCounter() {
    const el = document.getElementById('header-node-counter');
    if (el) el.textContent = this._nodeCount.toLocaleString();
  }
}
