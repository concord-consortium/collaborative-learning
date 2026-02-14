export const GeometryTileModes = ["select", "points", "polygon", "circle", "line"] as const;
export type GeometryTileMode = typeof GeometryTileModes[number];
