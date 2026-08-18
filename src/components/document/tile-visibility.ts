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
    if (overlap <= 0) continue;
    // Any positive overlap counts as visible: clamp to at least 1% so a barely-on-screen tile
    // (whose fraction would round to 0) isn't dropped, honoring the 1..100 percentVisible contract.
    const percentVisible = Math.max(1, Math.round((overlap / tile.height) * 100));
    visible.push({
      tileId: tile.tileId,
      tileType: tile.tileType,
      tileTitle: tile.tileTitle,
      percentVisible
    });
  }
  return visible;
}

/**
 * The cause to report when another trigger arrives before the pending snapshot settles. A layout
 * change often provokes a scroll of its own (the container clamps or resets scrollTop as the
 * document reflows), so a scroll never displaces a pending layout cause; otherwise the newest
 * cause wins.
 */
export function nextVisibilityCause(pending: VisibilityCause | undefined, incoming: VisibilityCause) {
  return incoming === "scroll" && pending && pending !== "scroll" ? pending : incoming;
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
