import { types, Instance } from "mobx-state-tree";

export const kGeometryToolID = "Geometry";

export const GeometryContentModel = types
  .model("GeometryContent", {
    type: types.literal(kGeometryToolID),
    // tool-specific types
  });

export type GeometryContentModelType = Instance<typeof GeometryContentModel>;
