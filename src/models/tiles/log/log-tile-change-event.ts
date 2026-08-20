import { Logger } from "../../../lib/logger";
import { IContext, processDocumentEventParams } from "../../../lib/logger-utils";
import { LogEventMethod, LogEventName } from "../../../lib/logger-types";
import { isTileBaseEvent, logTileBaseEvent } from "./log-tile-base-event";

export interface ITileChangeLogEvent extends Record<string, any> {
  tileId: string;
  operation: string;
  change: Record<string, any>;
  method?: LogEventMethod;
}

// Tile ids already warned about, so the standalone doc-editor/authoring app — which routes every edit
// through here but holds its document in React state rather than a store — warns once per tile, not
// once per edit.
const warnedMissingDocumentTileIds = new Set<string>();

function processTileChangeEvent(params: ITileChangeLogEvent, context?: IContext) {
  const { tileId, operation, change, ...others } = params;
  // Logger.stores is undefined until initializeLogger runs; stay null-safe and fall through to Logger.log.
  const { document, tileTitle } = processDocumentEventParams({ tileId }, context);
  if (!document && !warnedMissingDocumentTileIds.has(tileId)) {
    warnedMissingDocumentTileIds.add(tileId);
    console.warn(`logTileChangeEvent: no document found for tile ${tileId}; logging without enrichment`);
  }
  const legacyChangeProps = { toolId: tileId, operation, ...change };
  return { document, tileId, ...legacyChangeProps, tileTitle, ...others };
}

export function logTileChangeEvent(event: LogEventName, _params: ITileChangeLogEvent) {
  const params = processTileChangeEvent(_params, Logger.stores);
  if (isTileBaseEvent(params)) {
    logTileBaseEvent(event, params);
  }
  else {
    Logger.log(event, params);
  }
}
