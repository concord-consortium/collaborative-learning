import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";
import { registerTileContentInfo } from "../../models/tiles/tile-content-info";
import { kErrorTestDefaultHeight, kErrorTestTileType } from "./error-test-types";
import ErrorTestToolIcon from "./error-test-icon.svg";
import { ErrorTestToolComponent } from "./error-test-tile";
import { defaultErrorTestContent, ErrorTestContentModel } from "./error-test-content";

registerTileContentInfo({
  type: kErrorTestTileType,
  modelClass: ErrorTestContentModel,
  defaultContent: defaultErrorTestContent,
  defaultHeight: kErrorTestDefaultHeight
});

registerTileComponentInfo({
  type: kErrorTestTileType,
  Component: ErrorTestToolComponent,
  tileEltClass: "error-test-tool-tile",
  Icon: ErrorTestToolIcon
});
