import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { ITileContentModel, TileContentModel } from "../tile-content";
import { ITileExportOptions, IDefaultContentOptions } from "../tile-content-info";
import { RowList } from "../../document/row-list";
import { isPlaceholderContent, kPlaceholderTileType } from "../placeholder/placeholder-content";
import { StringBuilder } from "../../../utilities/string-builder";
import { ITileModel } from "../tile-model";
import { kTextTileType } from "../text/text-content";
import { generateQuestionId } from "./question-utils";
import { kQuestionTileType } from "./question-types";

export function defaultQuestionContent(options?: IDefaultContentOptions) {
  // Create prompt
  const promptTile = options?.tileFactory?.(kTextTileType);
  if (!promptTile) {
    throw new Error("Prompt tile could not be created");
  }
  promptTile.setTitle("Question Prompt");
  promptTile.setFixedPosition(true);

  // Create a placeholder tile
  const placeholderTile = options?.tileFactory?.(kPlaceholderTileType);
  if (!placeholderTile || !isPlaceholderContent(placeholderTile.content)) {
    throw new Error("Placeholder tile could not be created");
  }
  placeholderTile.content.setContainerType("QuestionContent");
  const tile = QuestionContentModel.create({});
  tile.addRowWithTiles([promptTile]);
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
    // When locked, the title and prompt cannot be edited.
    locked: types.optional(types.boolean, false),
    // Used in reporting; should be left unchanged for all locked copies of the same question
    questionId: types.optional(types.string, generateQuestionId()),
  })
  .views(self => ({
    exportJson(options: ITileExportOptions, tileMap: Map<string, ITileModel>) {
      const builder = new StringBuilder();
      builder.pushLine("{");
      builder.pushLine(`"type": "${self.type}",`, 2);
      builder.pushLine(`"version": ${self.version},`, 2);
      builder.pushLine(`"locked": ${self.locked},`, 2);
      builder.pushLine(`"questionId": "${self.questionId}",`, 2);
      builder.pushBlock(self.exportRowsAsJson(self.exportableRows(tileMap), tileMap,
        { ...options, appendComma: false }), 2);
      builder.pushLine("}");
      return builder.build();
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
