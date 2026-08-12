import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { getTileTitleForLogging } from "../../../lib/logger-utils";
import { logDocumentEvent } from "../../document/log-document-event";

// Logs that a tile received focus/selection (SELECT_TILE). Deliberately does NOT
// go through logTileBaseEvent: focusing a tile changes no content, so it must
// not fire the QUESTION_ANSWERS_CHANGE side-effect that logTileBaseEvent emits
// for tiles inside a Question. Resolves the tile's document for context (as
// logTileChangeEvent does), falling back to a bare event when the tile isn't in
// a loaded document. A no-op until the Logger is initialized (e.g. in tests that
// exercise selection without a logger), matching the rest of the log helpers'
// reliance on Logger.stores.
// `readOnly` distinguishes viewing a tile (resources panel, class work, linked
// read-only tiles) from focusing one in the student's own editable workspace,
// so analysis can filter view-vs-edit focus.
export function logTileFocusEvent(tileId: string, readOnly: boolean) {
  const stores = Logger.stores;
  if (!stores) return;
  const document = stores.documents.findDocumentOfTile(tileId) ||
                    stores.networkDocuments.findDocumentOfTile(tileId);
  const tileType = document?.content?.getTileType(tileId);
  const tileTitle = getTileTitleForLogging(tileId, document);
  if (document) {
    logDocumentEvent(LogEventName.SELECT_TILE, { document, tileId, tileType, tileTitle, readOnly });
  } else {
    Logger.log(LogEventName.SELECT_TILE, { tileId, tileType, tileTitle, readOnly });
  }
}
