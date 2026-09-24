import { ICase, IDataSet } from "../../../models/data/data-set";
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
