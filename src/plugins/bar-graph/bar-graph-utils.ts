import { SnapshotOut } from "mobx-state-tree";
import { LogEventName } from "../../lib/logger-types";
import { isImageUrl } from "../../models/data/data-types";
import { SharedModelEntrySnapshotType } from "../../models/document/shared-model-entry";
import { replaceJsonStringsWithUpdatedIds, UpdatedSharedDataSetIds } from "../../models/shared/shared-data-set";
import { logTileChangeEvent } from "../../models/tiles/log/log-tile-change-event";
import { getTileIdFromContent } from "../../models/tiles/tile-model";
import { BarGraphContentModel, BarGraphContentModelType } from "./bar-graph-content";

const kMissingValueString = "(no value)";
const kImageValueString = "<image>";

// Convert the value to a user-friendly string to display.
// Substitutes "(no value)" for missing data and "<image>" for image data
export function displayValue(attrValue: string | undefined): string {
  if (isImageUrl(attrValue)) return kImageValueString;
  return attrValue ? attrValue : kMissingValueString;
}

// Just substitute "(no value)" for undefined so we have a string can be used as a key
export function keyForValue(attrValue: string | undefined): string {
  return attrValue ? attrValue : kMissingValueString;
}

// true if the string matches the pattern that we use for missing data
export function isMissingData(display: string): boolean {
  return display === kMissingValueString;
}

// Wraps the native getBBox method to make it mockable in tests
export function getBBox(element: SVGGraphicsElement): DOMRect {
    return element.getBBox();
}

// Round a number up to the next multiple of 5.
export function roundTo5(n: number): number {
  return Math.max(5, Math.ceil(n/5)*5);
}

export function updateBarGraphContentWithNewSharedModelIds(
  content: SnapshotOut<typeof BarGraphContentModel>,
  sharedDataSetEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) {
  return replaceJsonStringsWithUpdatedIds(content, '"', ...Object.values(updatedSharedModelMap));
}

// Define types here to document all possible values that this tile logs
type LoggableOperation = "setPrimaryAttribute" | "setSecondaryAttribute" | "setYAxisLabel" | "selectCases";
type LoggableChange = {
  attributeId?: string | string[];
  attributeValue?: string | string[];
  text?: string;
};

export function logBarGraphEvent(
  model: BarGraphContentModelType, operation: LoggableOperation, change: LoggableChange) {
  const tileId = getTileIdFromContent(model) || "";

  logTileChangeEvent(LogEventName.BARGRAPH_TOOL_CHANGE, {
    tileId,
    operation,
    change
  });
}
