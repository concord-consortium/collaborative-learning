import { registerTileComponentInfo } from "../tile-component-info";
import { registerTileContentInfo } from "../tile-content-info";
import { TileMetadataModel } from "../tile-metadata";
import { kQuestionTileType, QuestionContentModel, defaultQuestionContent } from "./question-content";
import { QuestionTileComponent } from "../../../components/tiles/question/question-tile";

// TODO: Create and import these icons
import Icon from "../../../clue/assets/icons/question-tool.svg";

registerTileContentInfo({
  type: kQuestionTileType,
  displayName: "Question",
  modelClass: QuestionContentModel,
  metadataClass: TileMetadataModel,
  defaultContent: defaultQuestionContent
});

registerTileComponentInfo({
  type: kQuestionTileType,
  Component: QuestionTileComponent,
  tileEltClass: "question-tile",
  Icon
});
