import { MutableRefObject } from "react";
import { ICase, ICaseCreation } from "../../../models/data/data-set";
import { uniqueId } from "../../../utilities/js-utils";

export interface ICellWriteHandlers {
  onAddRows: (cases: ICaseCreation[]) => void;
  onUpdateRow: (caseValues: ICase) => void;
}

/**
 * Writes values into a case.
 *
 * The bottom row of the grid is a synthetic placeholder that is not yet a real case, so a write
 * targeting it has to create the case instead of updating one, and rotate the placeholder's id
 * so a fresh empty row takes its place. Both the cell editor and the image upload path go
 * through here, so they cannot drift.
 */
export function writeCellValue(
  caseValues: ICase,
  inputRowId: MutableRefObject<string>,
  handlers: ICellWriteHandlers
) {
  if (caseValues.__id__ === inputRowId.current) {
    handlers.onAddRows([caseValues]);
    inputRowId.current = uniqueId();
    return;
  }
  handlers.onUpdateRow(caseValues);
}
