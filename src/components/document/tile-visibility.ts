// Pure helpers for tile-visibility logging. Deliberately free of React / DOM / MobX so the
// vertical-% math and the log-params assembly can be unit-tested without mounting DocumentContent.

export type VisibilityCause =
  "scroll" | "windowResize" | "dividerResize" | "tileResize" | "documentChange"
  | "commentsToggle" | "comparisonToggle";

export interface IVisibleTile {
  tileId: string;
  tileType: string;
  tileTitle: string;
  percentVisible: number; // whole percent, 1..100 (tiles at 0 are dropped)
  containerId?: string;   // the tile this one is nested in, for tiles inside a container tile
}

/** A tile's vertical extent, in the same coordinate space as the viewport bounds. */
export interface ITileExtent {
  tileId: string;
  tileType: string;
  tileTitle: string;
  top: number;
  bottom: number;
  height: number;
  containerId?: string;
}

export interface IViewportBounds {
  top: number;
  bottom: number;
}

/**
 * For each tile, the fraction of its height inside the viewport, rounded to a whole percent. Tiles
 * with 0% visible (scrolled off, or zero height) are omitted. Input order is preserved.
 *
 * A tile nested in a container tile is reported alongside its container, so the entries can overlap
 * on screen and their percentages do not sum to a share of the viewport. `containerId` says which
 * entries are nested, so a consumer can aggregate over containers or over their contents.
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
    const entry: IVisibleTile = {
      tileId: tile.tileId,
      tileType: tile.tileType,
      tileTitle: tile.tileTitle,
      percentVisible
    };
    if (tile.containerId) entry.containerId = tile.containerId;
    visible.push(entry);
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

/**
 * Assembles the TILE_VISIBILITY_CHANGE params that describe what was visible, attaching each
 * cause-specific field only for its cause. The document's identity is added by the caller, via the
 * shared document/curriculum log helpers.
 */
export function buildVisibilityLogParams(
  cause: VisibilityCause,
  viewportHeight: number,
  tileCount: number,
  visibleTiles: IVisibleTile[],
  extra: IVisibilityLogExtra = {}
): Record<string, any> {
  const params: Record<string, any> = { cause, viewportHeight, tileCount, visibleTiles };
  if (cause === "dividerResize" && extra.dividerPosition != null) {
    params.dividerPosition = extra.dividerPosition;
  }
  if (cause === "tileResize" && extra.resizedRowId != null) {
    params.resizedRowId = extra.resizedRowId;
  }
  return params;
}
