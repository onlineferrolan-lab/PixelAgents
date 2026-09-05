import { useEffect } from 'react';

import { TILE_SIZE, ZOOM_MAX, ZOOM_MIN } from '../constants.js';
import { isKioskMode } from '../kioskMode.js';
import type { OfficeState } from '../office/engine/officeState.js';
import { TileType } from '../office/types.js';

/** Tiles of headroom above the office, so the tool labels that float over the
 *  top row of characters are never clipped by the top of the screen. */
const TOP_PADDING_TILES = 1;

/**
 * Kiosk auto-framing: fill the wall display with the office.
 *
 * Two things make this more than "set a bigger zoom":
 *
 * 1. The layout grid is mostly empty. The bundled default is 21x22 tiles but
 *    the office only occupies about 20x12 of them, all pushed to the bottom.
 *    Framing the grid wastes ~45% of the screen on void and pins the office to
 *    the bottom edge, so the fit is computed against the bounding box of what
 *    is actually drawn — non-void tiles plus placed furniture, which can sit a
 *    row above the floor.
 * 2. Centring therefore has to be explicit. Pan (0,0) centres the grid, which
 *    is not where the content is; the pan below re-centres on the content box
 *    using the same convention as the camera-follow code in OfficeCanvas
 *    (`pan = mapSize/2 - focus * zoom` puts `focus` at the canvas centre).
 *
 * Zoom is device pixels per sprite pixel and must stay an integer or the pixel
 * art picks up shimmer and half-pixel seams; `Math.floor` keeps it integral and
 * guarantees the content fits rather than overflowing by a fraction of a tile.
 *
 * No-op outside kiosk mode, so the interactive views keep their own zoom and
 * whatever the user set by hand.
 */
export function useKioskFit(
  containerRef: React.RefObject<HTMLDivElement | null>,
  officeState: OfficeState,
  layoutReady: boolean,
  layoutSeq: number,
  onZoomChange: (zoom: number) => void,
  panRef: React.MutableRefObject<{ x: number; y: number }>,
): void {
  useEffect(() => {
    if (!isKioskMode || !layoutReady) return;
    const container = containerRef.current;
    if (!container) return;

    function fit(): void {
      const rect = container!.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const layout = officeState.getLayout();
      const bounds = contentBounds(layout);
      if (!bounds) return;

      const contentCols = bounds.maxCol - bounds.minCol + 1;
      const contentRows = bounds.maxRow - bounds.minRow + 1 + TOP_PADDING_TILES;

      // The canvas is sized in device pixels, so the comparison has to be too.
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = rect.width * dpr;
      const canvasHeight = rect.height * dpr;

      const scale = Math.min(
        canvasWidth / (contentCols * TILE_SIZE),
        canvasHeight / (contentRows * TILE_SIZE),
      );
      const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(scale)));
      onZoomChange(zoom);

      // Centre of the content box in sprite pixels, padding included so the
      // headroom above is real rather than eaten by the centring.
      const focusX = ((bounds.minCol + bounds.maxCol + 1) / 2) * TILE_SIZE;
      const focusY = ((bounds.minRow - TOP_PADDING_TILES + bounds.maxRow + 1) / 2) * TILE_SIZE;

      panRef.current = {
        x: (layout.cols * TILE_SIZE * zoom) / 2 - focusX * zoom,
        y: (layout.rows * TILE_SIZE * zoom) / 2 - focusY * zoom,
      };
    }

    fit();

    // ResizeObserver rather than a window listener: it also catches the panel
    // being resized, and fires once on observe, covering a container that is
    // still 0x0 on the first paint.
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
    // layoutSeq is in the deps on purpose: OfficeState is mutated in place,
    // so editing the office (adding a room, moving seats) changes the content
    // box without changing any identity React could notice. Without it the
    // wall display would keep the old framing until someone resized or
    // reloaded it.
  }, [containerRef, officeState, layoutReady, layoutSeq, onZoomChange, panRef]);
}

interface Bounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

/** Bounding box, in tile coordinates, of everything the renderer actually
 *  draws. Returns null for a layout with nothing in it. */
function contentBounds(layout: {
  cols: number;
  rows: number;
  tiles: number[];
  furniture: Array<{ col: number; row: number }>;
}): Bounds | null {
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;

  function include(col: number, row: number): void {
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
  }

  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.cols; col++) {
      if (layout.tiles[row * layout.cols + col] !== TileType.VOID) include(col, row);
    }
  }
  // Furniture is anchored to a tile but can sit a row above the floor it
  // belongs to (wall shelves, monitors), so it widens the box.
  for (const item of layout.furniture) include(item.col, item.row);

  if (minCol === Infinity) return null;
  return { minCol, maxCol, minRow, maxRow };
}
