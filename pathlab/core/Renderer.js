/**
 * PathLab — Renderer
 * Layered canvas rendering engine.
 *
 * Three canvases are stacked on top of each other:
 *   static  (z=1) — grid lines, walls, start/goal markers
 *                   Redrawn only when grid structure changes.
 *   dynamic (z=2) — visited nodes, path lines, heatmap
 *                   Cleared and rebuilt per run.
 *   overlay (z=3) — cursor highlight, drag preview
 *                   Redrawn on every mouse move.
 *
 * This separation avoids redrawing the entire grid every frame
 * while keeping interaction feedback immediate.
 */
export class Renderer {
  constructor(staticCanvas, dynamicCanvas, overlayCanvas) {
    this._sc = staticCanvas;
    this._dc = dynamicCanvas;
    this._oc = overlayCanvas;
    this._sctx = staticCanvas.getContext("2d");
    this._dctx = dynamicCanvas.getContext("2d");
    this._octx = overlayCanvas.getContext("2d");

    // Configuration
    this.cellSize = 22;
    this.showHeatmap = true;

    // Per-run tracking
    this._algoColors = {}; // name -> hex color

    // Heatmap: one density counter per cell (summed across all algos)
    this._heatmap = null;

    // Colors (referenced by name in draw calls)
    this.C = {
      bg: "#0B0D11",
      gridLine: "#1A1E2A",
      wallFill: "#13161D",
      wallStroke: "#222840",
      wallHatch: "#1E2336",
      openFill: "#0B0D11",
      startFill: "#1a3d2e",
      startLabel: "#34D188",
      goalFill: "#3d2e0e",
      goalLabel: "#F4A832",
      cursorStroke: "#4B7FFF",
    };

    //Cursors
    this._lastCursorR = -1;
    this._lastCursorC = -1;
  }

  // ── Resize ─────────────────────────────────────

  /**
   * Resize all canvases to fit the given grid dimensions.
   * Call whenever rows, cols, or cellSize changes.
   * @param {number} rows
   * @param {number} cols
   * @param {number} cellSize
   */
  resize(rows, cols, cellSize) {
    this._rows = rows;
    this._cols = cols;
    this.cellSize = cellSize;

    const w = cols * cellSize;
    const h = rows * cellSize;

    for (const canvas of [this._sc, this._dc, this._oc]) {
      canvas.width = w;
      canvas.height = h;
    }

    // Update the stack wrapper size
    const stack = document.getElementById("canvas-stack");
    if (stack) {
      stack.style.width = `${w}px`;
      stack.style.height = `${h}px`;
    }
  }

  // ── Static layer — grid & terrain ──────────────

  /**
   * Full redraw of the static layer.
   * Call on grid resize, wall changes, or start/goal moves.
   * @param {import('./Grid.js').Grid} grid
   */
  drawGrid(grid) {
    const ctx = this._sctx;
    const cs = this.cellSize;

    ctx.clearRect(0, 0, this._sc.width, this._sc.height);

    // Background
    ctx.fillStyle = this.C.bg;
    ctx.fillRect(0, 0, this._sc.width, this._sc.height);

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        this._drawStaticCell(ctx, grid.cells[r][c], cs);
      }
    }
  }

  /**
   * Redraw a single cell on the static layer.
   * More efficient than a full redraw for interactive painting.
   * @param {import('./Grid.js').Grid} grid
   * @param {number} r
   * @param {number} c
   */
  drawCell(grid, r, c) {
    const cell = grid.cell(r, c);
    if (!cell) return;
    const ctx = this._sctx;
    const cs = this.cellSize;
    const x = c * cs;
    const y = r * cs;

    // Clear previous content for this cell
    ctx.clearRect(x, y, cs, cs);
    this._drawStaticCell(ctx, cell, cs);
  }

  /** Internal: draw one cell on the static layer. */
  _drawStaticCell(ctx, cell, cs) {
    const x = cell.c * cs;
    const y = cell.r * cs;

    if (cell.state === "wall") {
      // Wall: dark fill + subtle diagonal hatch
      ctx.fillStyle = this.C.wallFill;
      ctx.fillRect(x, y, cs, cs);

      // Hatch lines
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 0.5, y + 0.5, cs - 1, cs - 1);
      ctx.clip();
      ctx.strokeStyle = this.C.wallHatch;
      ctx.lineWidth = 0.6;
      const step = Math.max(5, cs * 0.3);
      for (let i = -cs; i < cs * 2; i += step) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + cs, y + cs);
        ctx.stroke();
      }
      ctx.restore();

      // Border
      ctx.strokeStyle = this.C.wallStroke;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
    } else {
      // Open cell: just grid line
      ctx.strokeStyle = this.C.gridLine;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
    }

    // Start marker
    if (cell.state === "start") {
      ctx.fillStyle = this.C.startFill;
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      this._drawLabel(ctx, "S", x, y, cs, this.C.startLabel);
    }

    // Goal marker
    if (cell.state === "goal") {
      ctx.fillStyle = this.C.goalFill;
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      this._drawLabel(ctx, "G", x, y, cs, this.C.goalLabel);
    }
  }

  /** Draw a centred letter label inside a cell. */
  _drawLabel(ctx, letter, x, y, cs, color) {
    const fontSize = Math.max(9, Math.min(14, Math.floor(cs * 0.55)));
    ctx.fillStyle = color;
    ctx.font = `700 ${fontSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, x + cs / 2, y + cs / 2 + 0.5);
  }

  // ── Dynamic layer — visits and path ────────────

  /** Clear the dynamic layer for a new run. */
  clearDynamic() {
    this._dctx.clearRect(0, 0, this._dc.width, this._dc.height);
    // Also clear overlay — ECF walls drawn there should reset with each new run
    this._octx.clearRect(0, 0, this._oc.width, this._oc.height);
  }

  /**
   * Paint a visited node on the dynamic layer.
   * @param {number} r
   * @param {number} c
   * @param {string} algoColor  — hex color for this algorithm
   */
  drawVisit(r, c, algoColor) {
    const ctx = this._dctx;
    const cs = this.cellSize;
    const x = c * cs;
    const y = r * cs;

    // Parse the hex color into RGB components
    const rgb = this._hexToRgb(algoColor);

    // Solid algorithm color fill with consistent opacity
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`;
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

    // Small center dot — slightly more opaque so individual
    // expansions are visible at any speed
    ctx.beginPath();
    ctx.arc(x + cs / 2, y + cs / 2, Math.max(1.5, cs * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.85)`;
    ctx.fill();
  }

  /**
   * Animate the final path on the dynamic layer.
   * @param {Array<{r:number,c:number}>} path
   * @param {string} algoColor
   */
  drawPath(path, algoColor) {
    if (!path || path.length < 2) return;
    const ctx = this._dctx;
    const cs = this.cellSize;

    // Path line
    ctx.beginPath();
    ctx.strokeStyle = algoColor;
    ctx.lineWidth = Math.max(2, cs * 0.22);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.moveTo(path[0].c * cs + cs / 2, path[0].r * cs + cs / 2);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].c * cs + cs / 2, path[i].r * cs + cs / 2);
    }
    ctx.stroke();

    // Node dots along the path
    const dotR = Math.max(2, cs * 0.16);
    for (const { r, c } of path) {
      ctx.beginPath();
      ctx.arc(c * cs + cs / 2, r * cs + cs / 2, dotR, 0, Math.PI * 2);
      ctx.fillStyle = algoColor;
      ctx.fill();
    }
  }

  // ── Overlay layer — cursor & preview ───────────

  /**
   * Draw cursor highlight on the overlay layer.
   * Call on every mouse move. Pass r=-1 to clear.
   * @param {number} r
   * @param {number} c
   * @param {string} [tool='wall'] — affects cursor color
   */
  drawCursor(r, c, tool = "wall") {
    const ctx = this._octx;
    const cs = this.cellSize;

    // Clear ONLY the previous cursor cell, not the whole overlay
    if (this._lastCursorR >= 0) {
      // Redraw ECF walls at previous cursor position if needed —
      // we can't do that here, so instead just clear a small area
      ctx.clearRect(this._lastCursorC * cs, this._lastCursorR * cs, cs, cs);
    }

    this._lastCursorR = r;
    this._lastCursorC = c;

    if (r < 0 || c < 0 || r >= this._rows || c >= this._cols) return;

    const x = c * cs;
    const y = r * cs;

    const colorMap = {
      wall: "#E8524A",
      erase: "#34D188",
      start: "#34D188",
      goal: "#F4A832",
    };
    const color = colorMap[tool] ?? this.C.cursorStroke;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
    ctx.fillStyle = color + "18";
    ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
  }

  // ── Heatmap color mapping ──────────────────────

  /**
   * Map t ∈ [0,1] to an RGB triple for heatmap coloring.
   * 0 = blue (cool/explored first), 0.5 = amber, 1 = red (explored last).
   * @param {number} t
   * @returns {[number, number, number]}
   */
  _heatColor(t) {
    if (t < 0.5) {
      // Blue → Amber
      const s = t * 2;
      return [
        Math.round(75 + s * (244 - 75)), // R: 75 → 244
        Math.round(127 + s * (168 - 127)), // G: 127 → 168
        Math.round(255 + s * (50 - 255)), // B: 255 → 50
      ];
    } else {
      // Amber → Red
      const s = (t - 0.5) * 2;
      return [
        Math.round(244 + s * (232 - 244)), // R: 244 → 232
        Math.round(168 + s * (82 - 168)), // G: 168 → 82
        Math.round(50 + s * (74 - 50)), // B: 50 → 74
      ];
    }
  }

  // ── Utilities ──────────────────────────────────

  /**
   * Calculate the best cell size to fill the available viewport.
   * @param {number} rows
   * @param {number} cols
   * @param {number} availW — available width in px
   * @param {number} availH — available height in px
   * @returns {number}
   */
  static calcCellSize(rows, cols, availW, availH) {
    const byWidth = Math.floor(availW / cols);
    const byHeight = Math.floor(availH / rows);
    return Math.max(10, Math.min(36, Math.min(byWidth, byHeight)));
  }

  /**
   * Parse a hex color string into {r, g, b}.
   * Handles both '#RRGGBB' and '#RGB' formats.
   * Falls back to accent blue if unparseable.
   */
  _hexToRgb(hex) {
    if (!hex) return { r: 75, g: 127, b: 255 };
    const clean = hex.replace("#", "");
    if (clean.length === 3) {
      return {
        r: parseInt(clean[0] + clean[0], 16),
        g: parseInt(clean[1] + clean[1], 16),
        b: parseInt(clean[2] + clean[2], 16),
      };
    }
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
}
