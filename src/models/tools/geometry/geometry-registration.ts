import { registerToolContentInfo } from "../tool-content-info";
import { GeometryContentModel, GeometryMetadataModel, defaultGeometryContent } from "./geometry-content";
import { kGeometryToolID } from "./geometry-types";
import { kGeometryDefaultHeight } from "./jxg-types";
import GeometryToolComponent from "../../../components/tools/geometry-tool/geometry-tool";
import GeometryToolIcon from "../../../clue/assets/icons/graph-tool.svg";

registerToolContentInfo({
  id: kGeometryToolID,
  titleBase: "Graph",
  modelClass: GeometryContentModel,
  metadataClass: GeometryMetadataModel,
  addSidecarNotes: true,
  defaultHeight: kGeometryDefaultHeight,
  exportNonDefaultHeight: true,
  defaultContent: defaultGeometryContent,
  Component: GeometryToolComponent,
  toolTileClass: "geometry-tool-tile",
  tileHandlesOwnSelection: true,
  Icon: GeometryToolIcon
});
