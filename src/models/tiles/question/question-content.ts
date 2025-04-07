import stringify from "json-stringify-pretty-compact";
import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { ITileContentModel, TileContentModel } from "../tile-content";
import { ITileExportOptions } from "../tile-content-info";

export const kQuestionTileType = "Question";

export function defaultQuestionContent() {
  return QuestionContentModel.create();
}

export const QuestionContentModel = TileContentModel
  .named("QuestionContent")
  .props({
    type: types.optional(types.literal(kQuestionTileType), kQuestionTileType),
    version: types.optional(types.number, 1)
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      return stringify(snapshot, {maxLength: 200});
    },
  }));

export type QuestionContentModelType = Instance<typeof QuestionContentModel>;

export function isQuestionModel(model?: ITileContentModel): model is QuestionContentModelType {
  return model?.type === kQuestionTileType;
}

export function createQuestionContent(snapshot?: SnapshotIn<typeof QuestionContentModel>) {
  return QuestionContentModel.create({
    ...snapshot
  });
}
