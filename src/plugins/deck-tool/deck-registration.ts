import { registerToolContentInfo } from "../../models/tools/tool-content-info";
import { kDeckDefaultHeight, kDeckToolID } from "./deck-types";
import DeckToolIcon from "./deck-icon.svg";
import { DeckToolComponent } from "./deck-tool";
import { defaultDeckContent, DeckContentModel } from "./deck-content";


registerToolContentInfo({
  id: kDeckToolID,
  modelClass: DeckContentModel,
  defaultContent: defaultDeckContent,
  Component: DeckToolComponent,
  defaultHeight: kDeckDefaultHeight,
  toolTileClass: "deck-tool-tile",
  Icon: DeckToolIcon
});
