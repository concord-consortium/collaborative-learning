export const GeometryTileModes = ["select", "points", "polygon"] as const;
export type GeometryTileMode = typeof GeometryTileModes[number];
