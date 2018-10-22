import { types, Instance } from "mobx-state-tree";

export const kDrawingToolID = "Drawing";

export const kDrawingDefaultHeight = 320;

export function defaultDrawingContent() {
  return DrawingContentModel.create({
                            type: kDrawingToolID
                          });
}

export const DrawingContentModel = types
  .model("DrawingTool", {
    type: types.optional(types.literal(kDrawingToolID), kDrawingToolID)
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    }
  }));

export type DrawingContentModelType = Instance<typeof DrawingContentModel>;
