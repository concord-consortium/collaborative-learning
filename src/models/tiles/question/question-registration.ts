import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { kQuestionTileType, QuestionContentModel, defaultQuestionContent } from "./question-content";
import { QuestionTileComponent } from "../../../components/tiles/question/question-tile";
import { updateQuestionContentForNewDocument } from "./question-utils";

import Icon from "../../../clue/assets/icons/question-tool.svg";
import HeaderIcon from "../../../assets/icons/sort-by-tools/question-tile-id.svg";

registerTileContentInfo({
  type: kQuestionTileType,
  displayName: "Question",
  modelClass: QuestionContentModel,
  metadataClass: TileMetadataModel,
  defaultContent: defaultQuestionContent,
  updateContentForNewDocument: updateQuestionContentForNewDocument
});

registerTileComponentInfo({
  type: kQuestionTileType,
  Component: QuestionTileComponent,
  tileEltClass: "question-tile",
  tileHandlesOwnSelection: true,
  Icon,
  HeaderIcon
});
