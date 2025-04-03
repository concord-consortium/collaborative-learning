import stringify from "json-stringify-pretty-compact";
import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { ITileContentModel, TileContentModel } from "../tile-content";
import { ITileExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { RowList } from "../../document/row-list";
import { kPlaceholderTileType } from "../placeholder/placeholder-content";

export const kQuestionTileType = "Question";

export function defaultQuestionContent(options?: IDefaultContentOptions) {
  // Create a placeholder tile
  const placeholderTile = options?.tileFactory?.(kPlaceholderTileType);
  if (!placeholderTile) {
    throw new Error("Placeholder tile could not be created");
  }
  const tile = QuestionContentModel.create({});
  tile.addRowWithTiles([placeholderTile]);

  return tile;
}

export const QuestionContentModel = types.compose(
    "QuestionContent",
    TileContentModel,
    RowList)
  .props({
    type: types.optional(types.literal(kQuestionTileType), kQuestionTileType),
    version: types.optional(types.number, 1),
    locked: types.optional(types.boolean, false),
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      return stringify(snapshot, {maxLength: 200});
    },
  }))
  .actions(self => ({
    setLocked(locked: boolean) {
      self.locked = locked;
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
