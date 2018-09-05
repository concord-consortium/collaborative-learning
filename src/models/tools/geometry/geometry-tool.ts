import { types } from "mobx-state-tree";

export const kGeometryToolID = "Geometry";

export const GeometryToolModel = types
  .model("GeometryTool", {
    type: types.literal(kGeometryToolID)
    // tool-specific types
  });

export type GeometryToolModelType = typeof GeometryToolModel.Type;
