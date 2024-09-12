import { SnapshotOut } from "mobx-state-tree";
import { SharedModelEntrySnapshotType } from "../../models/document/shared-model-entry";
import { replaceJsonStringsWithUpdatedIds, UpdatedSharedDataSetIds } from "../../models/shared/shared-data-set";
import { BarGraphContentModel } from "./bar-graph-content";

const kMissingValueString = "(no value)";

// Substitute "(no value)" for missing data
export function displayValue(attrValue: string | undefined): string {
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
