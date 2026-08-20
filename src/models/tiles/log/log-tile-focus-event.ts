import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { processDocumentEventParams } from "../../../lib/logger-utils";
import { logDocumentEvent } from "../../document/log-document-event";

// Logs that a tile received focus/selection (SELECT_TILE).
// `readOnly` distinguishes viewing a tile (resources panel, class work, linked
// read-only tiles) from focusing one in the student's own editable workspace,
// so analysis can filter view-vs-edit focus.
export function logTileFocusEvent(tileId: string, readOnly: boolean) {
  const { document, tileTitle, tileType } = processDocumentEventParams({ tileId }, Logger.stores);
  if (document) {
    logDocumentEvent(LogEventName.SELECT_TILE, { document, tileId, tileType, tileTitle, readOnly });
  } else {
    Logger.log(LogEventName.SELECT_TILE, { tileId, tileType, tileTitle, readOnly });
  }
}
