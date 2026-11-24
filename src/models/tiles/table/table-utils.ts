import { decipherCellId, getCellId } from "../../../../shared/annotations/object-ids";
import { TableContentSnapshotType } from "./table-content";
import { IClueObjectSnapshot } from "../../annotations/clue-object";
import { UpdatedSharedDataSetIds } from "../../shared/shared-data-set";
import { SharedModelEntrySnapshotType } from "../../document/shared-model-entry";

// Defined in shared/ so the AI summarizer reads annotation endpoints with the same format the
// client writes them with. Re-exported here because src/ already imports them from this file.
export { decipherCellId, getCellId };

export function updateTableContentWithNewSharedModelIds(
  content: TableContentSnapshotType,
  sharedDataSetEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) {
  // Column widths uses attribute ids, so we have to update them when updating shared dataset ids
  const columnWidths: Record<string, number> = {};
  sharedDataSetEntries.forEach(sharedDataSetEntry => {
    const originalSharedDataSetId = sharedDataSetEntry.sharedModel.id;
    if (originalSharedDataSetId) {
      const attributeIdMap = updatedSharedModelMap[originalSharedDataSetId].attributeIdMap;
      for (const entry of Object.entries(content.columnWidths ?? {})) {
        const originalId = entry[0];
        const width = entry[1] as number;
        if (width !== undefined && originalId && attributeIdMap[originalId]) {
            columnWidths[attributeIdMap[originalId]] = width;
        }
      }
    }
  });
  return { ...content, columnWidths };
}

export function updateTableObjectWithNewSharedModelIds(
  object: IClueObjectSnapshot,
  sharedDataSetEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) {
  if (object.objectType === "cell") {
    const { attributeId, caseId } = decipherCellId(object.objectId);
    let newAttributeId, newCaseId;
    sharedDataSetEntries.forEach(sharedDataSetEntry => {
      const originalSharedDataSetId = sharedDataSetEntry.sharedModel.id;
      if (originalSharedDataSetId) {
        const attributeIdMap = updatedSharedModelMap[originalSharedDataSetId].attributeIdMap;
        if (attributeId && attributeIdMap[attributeId]) {
          newAttributeId = attributeIdMap[attributeId];
        }
        const caseIdMap = updatedSharedModelMap[originalSharedDataSetId].caseIdMap;
        if (caseId && caseIdMap[caseId]) {
          newCaseId = caseIdMap[caseId];
        }
      }
    });
    if (newAttributeId && newCaseId) {
      const newId = getCellId(newCaseId, newAttributeId);
      object.objectId = newId;
      return newId;
    }
  }
}
