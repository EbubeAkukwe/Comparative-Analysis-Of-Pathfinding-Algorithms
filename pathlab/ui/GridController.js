/**
 * PathLab — GridController
 * Handles all mouse and touch events on the overlay canvas.
 * Translates pointer coordinates to grid cells and delegates
 * to the appropriate action based on the current tool.
 *
 * Emits:
 *   grid:changed   { r, c, prevState, nextState }
 *   (plus calls renderer.drawCell and renderer.drawCursor directly)
 */
import { EventBus } from '../core/EventBus.js';
import { State, setCursor } from '../core/StateManager.js';

export class GridController {
  /**
   * @param {import('../core/Grid.js').Grid}         grid
   * @param {import('../core/Renderer.js').Renderer} renderer
   * @param {HTMLCanvasElement}                      overlayCanvas
   * @param {import('../core/AlgorithmRunner.js').AlgorithmRunner} runner
   */
  constructor(grid, renderer, overlayCanvas, runner) {
    this._grid     = grid;
    this._renderer = renderer;
    this._canvas   = overlayCanvas;
    this._runner   = runner;

    this._isDragging = false;
    this._lastCell   = null; // avoid redundant redraws on same cell

    this._bindEvents();
  }

  // ── Public ─────────────────────────────────────

  /** Call when grid or renderer resizes so coordinates stay accurate. */
  refresh() {
    this._lastCell = null;
  }

  // ── Event binding ──────────────────────────────

  _bindEvents() {
    const c = this._canvas;

    // Mouse
    c.addEventListener('mousedown',  e => this._onDown(e));
    c.addEventListener('mousemove',  e => this._onMove(e));
    c.addEventListener('mouseup',    e => this._onUp(e));
    c.addEventListener('mouseleave', e => this._onLeave(e));

    // Touch
    c.addEventListener('touchstart', e => { e.preventDefault(); this._onDown(e); }, { passive: false });
    c.addEventListener('touchmove',  e => { e.preventDefault(); this._onMove(e); }, { passive: false });
    c.addEventListener('touchend',   e => { e.preventDefault(); this._onUp(e); },   { passive: false });
    c.addEventListener('touchcancel',e => { e.preventDefault(); this._onLeave(e); },{ passive: false });

    // Right-click = quick erase
    c.addEventListener('contextmenu', e => {
      e.preventDefault();
      const pos = this._cellFromEvent(e);
      if (!pos) return;
      this._applyTool(pos.r, pos.c, 'erase');
    });
  }

  // ── Coordinate mapping ─────────────────────────

  /**
   * Map a pointer event to a grid cell {r, c}.
   * Returns null if outside the canvas bounds.
   * @param {MouseEvent|TouchEvent} e
   * @returns {{r:number,c:number}|null}
   */
  _cellFromEvent(e) {
    const rect   = this._canvas.getBoundingClientRect();
    const scaleX = this._canvas.width  / rect.width;
    const scaleY = this._canvas.height / rect.height;

    const source   = e.touches ? e.touches[0] : e;
    const clientX  = source.clientX;
    const clientY  = source.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top)  * scaleY;
    const cs = this._renderer.cellSize;

    const r = Math.floor(y / cs);
    const c = Math.floor(x / cs);

    if (r < 0 || r >= this._grid.rows || c < 0 || c >= this._grid.cols) return null;
    return { r, c };
  }

  // ── Pointer handlers ───────────────────────────

  _onDown(e) {
    this._isDragging = true;
    const pos = this._cellFromEvent(e);
    if (!pos) return;
    this._applyTool(pos.r, pos.c, State.tool);
    this._updateCursor(pos.r, pos.c);
  }

  _onMove(e) {
    const pos = this._cellFromEvent(e);
    if (!pos) {
      this._renderer.drawCursor(-1, -1, State.tool);
      setCursor(-1, -1);
      return;
    }

    setCursor(pos.r, pos.c);
    this._renderer.drawCursor(pos.r, pos.c, State.tool);
    EventBus.emit('cursor:move', { r: pos.r, c: pos.c });

    if (this._isDragging) {
      // Only drag-apply wall/erase — not start/goal (they snap on click)
      const tool = State.tool;
      if (tool === 'wall' || tool === 'erase') {
        this._applyTool(pos.r, pos.c, tool);
      }
    }
  }

  _onUp() {
    this._isDragging = false;
    this._lastCell   = null;
  }

  _onLeave() {
    this._isDragging = false;
    this._lastCell   = null;
    this._renderer.drawCursor(-1, -1, State.tool);
    setCursor(-1, -1);
    EventBus.emit('cursor:move', { r: -1, c: -1 });
  }

  _updateCursor(r, c) {
    setCursor(r, c);
    EventBus.emit('cursor:move', { r, c });
  }

  // ── Tool application ───────────────────────────

  /**
   * Apply the given tool to grid cell (r, c).
   * @param {number} r
   * @param {number} c
   * @param {string} tool
   */
  _applyTool(r, c, tool) {
    const cellKey = `${r},${c}`;
    if (this._lastCell === cellKey && (tool === 'wall' || tool === 'erase')) return;
    this._lastCell = cellKey;

    const grid = this._grid;
    const cell = grid.cell(r, c);
    if (!cell) return;

    const prevState = cell.state;
    let changed     = false;

    switch (tool) {
      case 'wall':
        changed = grid.placeWall(r, c);
        // Notify runner for dynamic obstacle support
        if (changed && this._runner.dynamicMode) {
          this._runner.notifyObstacle(r, c);
        }
        break;

      case 'erase':
        changed = grid.eraseWall(r, c);
        break;

      case 'start': {
        const prevR = grid.start.r, prevC = grid.start.c;
        changed = grid.moveStart(r, c);
        if (changed) {
          // Redraw old start cell
          this._renderer.drawCell(grid, prevR, prevC);
        }
        break;
      }

      case 'goal': {
        const prevR = grid.goal.r, prevC = grid.goal.c;
        changed = grid.moveGoal(r, c);
        if (changed) {
          this._renderer.drawCell(grid, prevR, prevC);
        }
        break;
      }
    }

    if (changed) {
      this._renderer.drawCell(grid, r, c);
      EventBus.emit('grid:changed', {
        r, c,
        prevState,
        nextState: cell.state,
        tool,
      });
    }
  }
}
