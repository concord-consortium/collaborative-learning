import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { DrawingContentModel, DrawingToolMetadataModel, defaultDrawingContent } from "./model/drawing-content";
import { kDrawingTileType, kDrawingDefaultHeight } from "./model/drawing-types";
import DrawingToolComponent from "./components/drawing-tile";
import { DrawingMigrator } from "./model/drawing-migrator";
import { registerDrawingObjectInfo, registerDrawingToolInfo } from "./components/drawing-object-manager";
import { GroupComponent, GroupObject } from "./objects/group";
import { registerTileToolbarButtons } from "../../components/toolbar/toolbar-button-manager";
import {
  EllipseButton, LineButton, RectangleButton, SelectButton, TextButton
} from "./toolbar-buttons/mode-buttons";
import { VectorButton } from "./toolbar-buttons/vector-button";
import { StampButton } from "./toolbar-buttons/stamp-button";
import { FillColorButton, StrokeColorButton } from "./toolbar-buttons/select-buttons";
import { DeleteButton, DuplicateButton, FlipHorizontalButton, FlipVerticalButton,
  GroupButton, RotateRightButton, UngroupButton } from "./action-buttons";
import { ImageUploadButton } from "./toolbar-buttons/image-upload-button";
import { ZoomInButton, ZoomOutButton, FitAllButton } from "./toolbar-buttons/zoom-buttons";
import { NavigatorButton } from "../../components/toolbar/navigator-button";
import { AlignButton } from "./toolbar-buttons/align-button";

import Icon from "./assets/draw-tool.svg";
import HeaderIcon from "./assets/sketch-tile-id.svg";

registerTileContentInfo({
  type: kDrawingTileType,
  displayName: "Sketch",
  // TODO: maybe there is a better way to do this kind of casting?
  //   The issue is that modelClass prop has a type of `typeof TileContentModel`,
  //   That type is pretty restrictive and doesn't accommodate the return of
  //   types.snapshotProcessor. There might be a better way to get a
  //   typescript type for a MST "Class" which is less restrictive
  modelClass: DrawingMigrator as typeof DrawingContentModel,
  metadataClass: DrawingToolMetadataModel,
  defaultHeight: kDrawingDefaultHeight,
  exportNonDefaultHeight: true,
  defaultContent: defaultDrawingContent
});

registerTileComponentInfo({
  type: kDrawingTileType,
  Component: DrawingToolComponent,
  tileEltClass: "drawing-tool-tile",
  Icon,
  HeaderIcon,
  tileHandlesOwnSelection: true
});

// These are added via registration functions rather than
// directly specified in drawing-object-manager.tsx in order
// to avoid circular "import" loops like
// group -> DrawingObjectMSTUnion -> group
registerDrawingObjectInfo({
  type: "group",
  component: GroupComponent,
  modelClass: GroupObject
});

registerDrawingToolInfo({
  name: "group"
});

registerDrawingToolInfo({
  name: "ungroup"
});

registerTileToolbarButtons("drawing", [
  { name: "select", component: SelectButton },
  { name: "line", component: LineButton },
  { name: "vector", component: VectorButton },
  { name: "rectangle", component: RectangleButton },
  { name: "ellipse", component: EllipseButton },
  { name: "stamp", component: StampButton },
  { name: "stroke-color", component: StrokeColorButton },
  { name: "fill-color", component: FillColorButton },
  { name: "text", component: TextButton },
  { name: "upload", component: ImageUploadButton },
  { name: "align", component: AlignButton },
  { name: "group", component: GroupButton },
  { name: "ungroup", component: UngroupButton },
  { name: "duplicate", component: DuplicateButton },
  { name: "rotate-right", component: RotateRightButton },
  { name: "flip-horizontal", component: FlipHorizontalButton },
  { name: "flip-vertical", component: FlipVerticalButton },
  { name: "zoom-in", component: ZoomInButton },
  { name: "zoom-out", component: ZoomOutButton },
  { name: "fit-all", component: FitAllButton },
  { name: "navigator", component: NavigatorButton },
  { name: "delete", component: DeleteButton }
]);
