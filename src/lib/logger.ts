import { UserModelType } from "../models/user";
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

  public static logTileEvent(event: LogEventName, tile?: ToolTileModelType) {
    let parameters = {};
    if (tile) {
      parameters = {
        objectId: tile.id,
        objectType: tile.content.type,
        serializedObject: getSnapshot(tile).content
      };
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
      // documentKey: ...
      session: this.session,
      appMode: this.stores.appMode,
      time: Date.now(),       // eventually we will want server skew (or to add this via FB directly)
      event,
      method: "do",           // eventually we will want to support undo, redo
      parameters
    };
  }
}

function sendToLoggingService(data: LogMessage) {
  const request = new XMLHttpRequest();
  request.open("POST", logManagerUrl, true);
  request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
  request.send(JSON.stringify(data));
}
