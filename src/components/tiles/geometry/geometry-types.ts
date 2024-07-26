export const GeometryTileModes = ["select", "points", "polygon", "circle"] as const;
export type GeometryTileMode = typeof GeometryTileModes[number];
