// Pure helpers for CLUE-629 tile-visibility logging. Deliberately free of React / DOM / MobX so the
// vertical-% math and the log-params assembly can be unit-tested without mounting DocumentContent.

export type VisibilityCause =
  "scroll" | "windowResize" | "dividerResize" | "tileResize" | "documentChange"
  | "commentsToggle" | "comparisonToggle";

export interface IVisibleTile {
  tileId: string;
  tileType: string;
  tileTitle: string;
  percentVisible: number; // whole percent, 1..100 (tiles at 0 are dropped)
}

/** A tile's vertical extent, in the same coordinate space as the viewport bounds. */
export interface ITileExtent {
  tileId: string;
  tileType: string;
  tileTitle: string;
  top: number;
  bottom: number;
  height: number;
}

export interface IViewportBounds {
  top: number;
  bottom: number;
}

/**
 * For each tile, the fraction of its height inside the viewport, rounded to a whole percent. Tiles
 * with 0% visible (scrolled off, or zero height) are omitted. Input order is preserved.
 */
export function computeVisibleTiles(viewport: IViewportBounds, tiles: ITileExtent[]): IVisibleTile[] {
  const visible: IVisibleTile[] = [];
  for (const tile of tiles) {
    if (tile.height <= 0) continue;
    const overlap = Math.min(tile.bottom, viewport.bottom) - Math.max(tile.top, viewport.top);
    const percentVisible = Math.round((Math.max(0, overlap) / tile.height) * 100);
    if (percentVisible > 0) {
      visible.push({
        tileId: tile.tileId,
        tileType: tile.tileType,
        tileTitle: tile.tileTitle,
        percentVisible
      });
    }
  }
  return visible;
}

export interface IVisibilityLogExtra {
  dividerPosition?: number;
  resizedRowId?: string;
}

export interface IVisibilityDocumentContext {
  documentId?: string;
  documentType?: string;
  documentTitle?: string;
  documentOwner?: string;
}

/** Assembles TILE_VISIBILITY_CHANGE params, attaching each cause-specific field only for its cause. */
export function buildVisibilityLogParams(
  cause: VisibilityCause,
  documentContext: IVisibilityDocumentContext,
  viewportHeight: number,
  tileCount: number,
  visibleTiles: IVisibleTile[],
  extra: IVisibilityLogExtra = {}
): Record<string, any> {
  const params: Record<string, any> = { cause, ...documentContext, viewportHeight, tileCount, visibleTiles };
  if (cause === "dividerResize" && extra.dividerPosition != null) {
    params.dividerPosition = extra.dividerPosition;
  }
  if (cause === "tileResize" && extra.resizedRowId != null) {
    params.resizedRowId = extra.resizedRowId;
  }
  return params;
}
