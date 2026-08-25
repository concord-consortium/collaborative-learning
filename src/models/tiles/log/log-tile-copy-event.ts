import { Logger } from "../../../lib/logger";
import { LogEventName } from "../../../lib/logger-types";
import { IDocumentLookupContext, resolveTileLogContext } from "../../../lib/logger-utils";
import { ITileModel } from "../tile-model";
import { logTileDocumentEvent } from "./log-tile-document-event";

interface ITileCopyLogEvent extends Record<string, any> {
  tile: ITileModel;
  originalTileId: string;
}

function processTileCopyEventParams(params: ITileCopyLogEvent, context: IDocumentLookupContext) {
  const { originalTileId, ...others } = params;
  const { document: srcDocument, tileTitle: originalTileTitle } =
    resolveTileLogContext({ tileId: originalTileId }, context);
  const srcProps = srcDocument
                    ? {
                      sourceUsername: srcDocument.uid,
                      sourceObjectId: originalTileId,
                      sourceObjectTitle: originalTileTitle,
                      sourceDocumentKey: srcDocument.key,
                      sourceDocumentType: srcDocument.type,
                      sourceDocumentTitle: srcDocument.title || "",
                      sourceDocumentProperties: srcDocument.properties || {},
                      sourceSectionId: srcDocument.content?.getSectionIdForTile(originalTileId)
                    }
                    : undefined;
  return { ...srcProps, ...others };
}

export function logTileCopyEvent(event: LogEventName, _params: ITileCopyLogEvent) {
  const params = processTileCopyEventParams(_params, Logger.stores);
  logTileDocumentEvent(event, params);
}
