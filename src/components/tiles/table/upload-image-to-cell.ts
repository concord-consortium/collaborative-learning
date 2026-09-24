import { ICase, ICaseCreation, IDataSet } from "../../../models/data/data-set";
import { ingestImage } from "../../../utilities/image-ingest";

/**
 * Stores an image and writes the resulting reference into the currently selected cell.
 *
 * The target cell is captured before the await: ingesting is async and the selection can
 * move while it is in flight, but the image belongs to the cell the user was on when they
 * chose it.
 */
export async function uploadImageToCell(
  dataSet: IDataSet,
  onUpdateRow: (caseValues: ICase) => void,
  file: File
) {
  const cell = dataSet.firstSelectedCell;
  if (!cell) return;

  const contentUrl = await ingestImage(file);
  if (contentUrl) {
    onUpdateRow({ __id__: cell.caseId, [cell.attributeId]: contentUrl });
  }
}

export interface ICellWriteHandlers {
  onAddRows: (cases: ICaseCreation[]) => void;
  onUpdateRow: (caseValues: ICase) => void;
}

/**
 * Writes values into a case, creating the case first when the target is the grid's synthetic
 * input row — the placeholder at the bottom of the table that is not yet a real case. Mirrors
 * what typing into that row does (use-data-set.ts onRowsChange).
 *
 * Returns true when a new case was created, so the caller can rotate the input row id.
 */
export function writeCellValue(
  caseValues: ICase, inputRowId: string, handlers: ICellWriteHandlers
): boolean {
  if (caseValues.__id__ === inputRowId) {
    handlers.onAddRows([caseValues]);
    return true;
  }
  handlers.onUpdateRow(caseValues);
  return false;
}
