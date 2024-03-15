import { TableContentSnapshotType } from "./table-content";
import { IClueObjectSnapshot } from "../../annotations/clue-object";
import { UpdatedSharedDataSetIds } from "../../shared/shared-data-set";
import { SharedModelEntrySnapshotType } from "../../document/shared-model-entry";

const cellIdRegEx = /^cell:{(.+)}:{(.+)}$/;

export function getCellId(caseId: string, attributeId: string) {
  return `cell:{${caseId}}:{${attributeId}}`;
}

export function decipherCellId(cellId: string) {
  const match = cellId.match(cellIdRegEx);
  if (match && match.length === 3) {
    const caseId = match[1];
    const attributeId = match[2];
    return { caseId, attributeId };
  }
  return {};
}

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
