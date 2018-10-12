import uuid = require("uuid");
import { getSnapshot } from "mobx-state-tree";
import { ToolTileModelType } from "../models/tools/tool-tile";
import { IStores } from "../models/stores";
import { InvestigationModelType } from "../models/curriculum/investigation";
import { ProblemModelType } from "../models/curriculum/problem";

const logManagerUrl = "//cc-log-manager.herokuapp.com/api/logs";
const applicationName = "CLUE";

interface LogMessage {
  application: string;
  username: string;
  classHash: string;
  session: string;
  appMode: string;
  investigation?: string;
  problem?: string;
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
  public static initializeLogger(stores: IStores, investigation?: InvestigationModelType, problem?: ProblemModelType) {
    this._instance = new Logger(stores, investigation, problem);
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
        documentType: document.type,
        section: document.section
      };

      if (event === LogEventName.COPY_TILE && metaData && metaData.originalTileId) {
        const sourceDocument = Logger.Instance.getDocumentInfo(metaData.originalTileId);
        parameters = {
          ...parameters,
          sourceUsername: sourceDocument.uid,
          souceObjectId: metaData.originalTileId,
          sourceDocumentKey: sourceDocument.key,
          sourceDocumentType: sourceDocument.type,
          sourceSection: sourceDocument.section || document.section   // if it's instructions, use dest doc's section
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
  private investigationTitle = "";
  private problemTitle = "";
  private session: string;

  private constructor(stores: IStores, investigation?: InvestigationModelType, problem?: ProblemModelType) {
    this.stores = stores;
    if (investigation) this.investigationTitle = investigation.title;
    if (problem) this.problemTitle = problem.title;
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
      investigation: this.investigationTitle,
      problem: this.problemTitle,
      time: Date.now(),       // eventually we will want server skew (or to add this via FB directly)
      event,
      method: "do",           // eventually we will want to support undo, redo
      parameters
    };
  }

  private getDocumentInfo(tileId: string): {type: string, key?: string, section?: string, uid?: string } {
    const document = this.stores.documents.findDocumentOfTile(tileId);
    if (document) {
      return {
        type: document.type,
        key: document.key,
        section: document.sectionId,
        uid: document.uid
      };
    } else {
      return {
        type: "Instructions"        // eventually we will need to include copying from supports
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
