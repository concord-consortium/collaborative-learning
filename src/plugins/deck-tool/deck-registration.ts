import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kDeckDefaultHeight, kDeckToolID } from "./deck-types";
import DeckToolIcon from "./assets/deck-icon.svg";
import { DeckToolComponent } from "./deck-tool";
import { defaultDeckContent, DeckContentModel } from "./deck-content";
import { ToolMetadataModel } from "../../models/tools/tool-types";


registerToolContentInfo({
  id: kDeckToolID,
  modelClass: DeckContentModel,
  titleBase: "Deck",
  metadataClass: ToolMetadataModel,
  defaultContent: defaultDeckContent,
  Component: DeckToolComponent,
  defaultHeight: kDeckDefaultHeight,
  toolTileClass: "deck-tool-tile",
  Icon: DeckToolIcon
});
