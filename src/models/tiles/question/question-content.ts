import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { TileContentModel } from "../tile-content";
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
      return [
        `{`,
        `  "type": "${kQuestionTileType}",`,
        `  "version": ${self.version}`,
        `}`
      ].join("\n");
    }
  }));

export type QuestionContentModelType = Instance<typeof QuestionContentModel>;

export function createQuestionContent(snapshot?: SnapshotIn<typeof QuestionContentModel>) {
  return QuestionContentModel.create({
    ...snapshot
  });
}
