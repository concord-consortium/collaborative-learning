import uuid = require("uuid");
import { ToolTileModelType } from "../models/tools/tool-tile";
import { IStores } from "../models/stores";
import { getSnapshot } from "mobx-state-tree";

const logManagerUrl = "//cc-log-manager.herokuapp.com/api/logs";
const applicationName = "CLUE";

interface LogMessage {
  application: string;
  username: string;
  classHash: string;
  session: string;
  appMode: string;
  time: number;
  event: string;
  method: string;
  parameters: any;
}

interface LoggingMetaData {
  originalTileId?: string;
}

export enum LogEventName {
  CREATE_TILE,
  COPY_TILE,
  DELETE_TILE
}

export class Logger {
  public static initializeLogger(stores: IStores) {
    this._instance = new Logger(stores);
  }

  public static log(event: LogEventName, parameters: object) {
    if (!this._instance) return;

    const eventString = LogEventName[event];
    const logMessage = Logger.Instance.createLogMessage(eventString, parameters);
    sendToLoggingService(logMessage);
  }

  public static logTileEvent(event: LogEventName, tile?: ToolTileModelType, metaData?: LoggingMetaData) {
    if (!this._instance) return;

    let parameters = {};
    if (tile) {
      const document = Logger.Instance.getDocumentInfo(tile.id);

      parameters = {
        objectId: tile.id,
        objectType: tile.content.type,
        serializedObject: getSnapshot(tile).content,
        documentKey: document.key,
        documentType: document.type
      };

      if (event === LogEventName.COPY_TILE && metaData && metaData.originalTileId) {
        const sourceDocument = Logger.Instance.getDocumentInfo(metaData.originalTileId);
        parameters = {
          ...parameters,
          souceObjectId: metaData.originalTileId,
          sourceDocumentKey: sourceDocument.key,
          sourceDocumentType: sourceDocument.type
        };
      }
    }
    Logger.log(event, parameters);
  }

  private static _instance: Logger;

  public static get Instance() {
    if (this._instance) {
      return this._instance;
    }
    throw new Error("Logger not initialized yet.");
  }

  private stores: IStores;
  private session: string;

  private constructor(stores: IStores) {
    this.stores = stores;
    this.session = uuid.v4();
  }

  private createLogMessage(event: string, parameters: {}): LogMessage {
    const user = this.stores.user;

    return {
      application: applicationName,
      username:  user.id,
      classHash: user.classHash,
      session: this.session,
      appMode: this.stores.appMode,
      time: Date.now(),       // eventually we will want server skew (or to add this via FB directly)
      event,
      method: "do",           // eventually we will want to support undo, redo
      parameters
    };
  }

  private getDocumentInfo(tileId: string): {key: string, type: string} {
    const document = this.stores.documents.findDocumentOfTile(tileId);
    if (document) {
      return {
        key: document.key,
        type: document.type
      };
    } else {
      return {
        key: "",
        type: "Instructions"        // is this assumption valid?
      };
    }
  }
}

function sendToLoggingService(data: LogMessage) {
  const request = new XMLHttpRequest();
  request.open("POST", logManagerUrl, true);
  request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
  request.send(JSON.stringify(data));
}
