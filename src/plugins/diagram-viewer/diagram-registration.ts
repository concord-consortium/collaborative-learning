import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kDiagramDefaultHeight, kDiagramTileType } from "./diagram-types";
import { defaultDiagramContent, DiagramContentModel } from "./diagram-content";
import { DiagramToolComponent } from "./diagram-tile";
import { DiagramMigrator } from "./diagram-migrator";
import { registerTileToolbarButtons } from "../../components/toolbar/toolbar-button-manager";
import { DeleteButton, EditVariableButton, FitViewToolbarButton, HideNavigatorButton, InsertVariableButton,
  LockLayoutButton, NewVariableButton, VariablesLinkButton, ZoomInToolbarButton, ZoomOutToolbarButton }
    from "./diagram-toolbar-buttons";

import Icon from "./src/assets/diagram-tool.svg";
import HeaderIcon from "./src/assets/diagram-tile-id.svg";

registerTileContentInfo({
  type: kDiagramTileType,
  displayName: "Diagram",
  // TODO: maybe there is there a better way to do this kind of casting?
  //   The issue is that modelClass prop has a type of `typeof TileContentModel`,
  //   That type is pretty restrictive and doesn't accommodate the return of
  //   types.snapshotProcessor. There might be a better way to get a
  //   typescript type for a MST "Class" which is less restrictive
  modelClass: DiagramMigrator as typeof DiagramContentModel,
  defaultContent: defaultDiagramContent,
  defaultHeight: kDiagramDefaultHeight,
  isVariableProvider: true
});

registerTileComponentInfo({
  type: kDiagramTileType,
  Component: DiagramToolComponent,
  tileEltClass: "diagram-tool-tile nowheel",
  Icon,
  HeaderIcon
});

registerTileToolbarButtons("diagram", [
  { name: "new-variable", component: NewVariableButton },
  { name: "insert-variable", component: InsertVariableButton },
  { name: "edit-variable", component: EditVariableButton },
  { name: "zoom-in", component: ZoomInToolbarButton },
  { name: "zoom-out", component: ZoomOutToolbarButton },
  { name: "fit-view", component: FitViewToolbarButton },
  { name: "toggle-lock", component: LockLayoutButton },
  { name: "toggle-navigator", component: HideNavigatorButton },
  { name: "variables-link", component: VariablesLinkButton },
  { name: "delete", component: DeleteButton }
]);
