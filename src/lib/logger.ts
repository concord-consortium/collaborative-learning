import * as uuid from "uuid/v4";
import { getSnapshot } from "mobx-state-tree";
import { ToolTileModelType } from "../models/tools/tool-tile";
import { IStores } from "../models/stores/stores";
import { InvestigationModelType } from "../models/curriculum/investigation";
import { ProblemModelType } from "../models/curriculum/problem";
import { DocumentModelType } from "../models/document/document";
import { JXGChange } from "../models/tools/geometry/jxg-changes";
import { DrawingToolChange } from "../models/tools/drawing/drawing-content";
import { ITableChange } from "../models/tools/table/table-content";
import { DEBUG_LOGGER } from "../lib/debug";

const logManagerUrl = "//cc-log-manager.herokuapp.com/api/logs";
const applicationName = "CLUE";

interface LogMessage {
  application: string;
  run_remote_endpoint?: string;
  username: string;
  classHash: string;
  session: string;
  appMode: string;
  investigation?: string;
  problem?: string;
  section?: string;
  group?: string;
  time: number;
  event: string;
  method: string;
  parameters: any;
}

interface TileLoggingMetadata {
  originalTileId?: string;
}

export enum LogEventMethod {
  DO = "do",
  UNDO = "undo",
  REDO = "redo"
}

export enum LogEventName {
  CREATE_TILE,
  COPY_TILE,
  DELETE_TILE,

  VIEW_SHOW_DOCUMENT,
  VIEW_SHOW_COMPARISON_DOCUMENT,
  VIEW_ENTER_FOUR_UP,
  VIEW_ENTER_ONE_UP,
  VIEW_SHOW_COMPARISON_PANEL,
  VIEW_HIDE_COMPARISON_PANEL,
  VIEW_SHOW_SUPPORT,

  CREATE_PERSONAL_DOCUMENT,
  CREATE_LEARNING_LOG,

  GRAPH_TOOL_CHANGE,
  DRAWING_TOOL_CHANGE,
  TABLE_TOOL_CHANGE,

  TILE_UNDO,
  TILE_REDO,

  // the followng are for potential debugging purposes and are all marked "internal"
  INTERNAL_AUTHENTICATED,
  INTERNAL_FIREBASE_DISCONNECTED,

  // the following TODOs are to be done when the functionality is added to the app
  DASHBOARD_SWITCH_CLASS,  // TODO: add logEvent call when functionality added
  DASHBOARD_SWITCH_PROBLEM,  // TODO: add logEvent call when functionality added
  DASHBOARD_CLICK_ON_GROUP,  // TODO: decide if this is needed, currently there is no way to select a group
  DASHBOARD_DESELECT_STUDENT,
  DASHBOARD_SELECT_STUDENT,
  DASHBOARD_TOGGLE_TO_WORKSPACE,
  DASHBOARD_TOGGLE_TO_DASHBOARD,
  DASHBOARD_TURN_METRICS_ON,  // TODO: add logEvent call when functionality added
}

type ToolChangeEventType = JXGChange | DrawingToolChange | ITableChange;

export class Logger {
  public static initializeLogger(stores: IStores, investigation?: InvestigationModelType, problem?: ProblemModelType) {
    if (DEBUG_LOGGER) {
      // tslint:disable-next-line:no-console
      console.log("Logger#initializeLogger called.");
    }
    this._instance = new Logger(stores, investigation, problem);
  }

  public static updateProblem(investigation: InvestigationModelType, problem: ProblemModelType) {
    this._instance.problemTitle = problem.title;
    this._instance.investigationTitle = investigation.title;
  }

  public static log(event: LogEventName, parameters?: object, method?: LogEventMethod) {
    if (!this._instance) return;

    const eventString = LogEventName[event];
    const logMessage = Logger.Instance.createLogMessage(eventString, parameters, method);
    sendToLoggingService(logMessage);
  }

  public static logTileEvent(event: LogEventName, tile?: ToolTileModelType, metaData?: TileLoggingMetadata) {
    if (!this._instance) return;

    let parameters = {};

    if (tile) {
      const document = Logger.Instance.getDocumentForTile(tile.id);

      parameters = {
        objectId: tile.id,
        objectType: tile.content.type,
        serializedObject: getSnapshot(tile).content,
        documentKey: document.key,
        documentType: document.type,
        section: document.section
      };

      if (event === LogEventName.COPY_TILE && metaData && metaData.originalTileId) {
        const sourceDocument = Logger.Instance.getDocumentForTile(metaData.originalTileId);
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

  public static logDocumentEvent(event: LogEventName, document: DocumentModelType) {
    const parameters = {
      documentKey: document.key,
      documentType: document.type
    };
    Logger.log(event, parameters);
  }

  public static logToolChange(
    eventName: LogEventName,
    operation: string,
    change: ToolChangeEventType,
    toolId: string,
    method?: LogEventMethod)
  {
    const parameters: {[k: string]: any} = {
      toolId,
      operation,
      ...change
    };

    Logger.log(eventName, parameters, method);
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
    this.session = uuid();
  }

  private createLogMessage(
    event: string,
    parameters?: {section?: string},
    method: LogEventMethod = LogEventMethod.DO
  ): LogMessage {
    const {user, ui, documents} = this.stores;

    const logMessage: LogMessage = {
      application: applicationName,
      username:  user.id,
      classHash: user.classHash,
      session: this.session,
      appMode: this.stores.appMode,
      investigation: this.investigationTitle,
      problem: this.problemTitle,
      time: Date.now(),       // eventually we will want server skew (or to add this via FB directly)
      event,
      method,
      parameters
    };

    if (user.loggingRemoteEndpoint) {
      logMessage.run_remote_endpoint = user.loggingRemoteEndpoint;
    }

    if (user.isStudent) {
      logMessage.group = user.latestGroupId;
    }

    return logMessage;
  }

  private getDocumentForTile(tileId: string): {type: string, key?: string, section?: string, uid?: string } {
    const document = this.stores.documents.findDocumentOfTile(tileId);
    if (document) {
      return {
        type: document.type,
        key: document.key,
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
  if (DEBUG_LOGGER) {
    // tslint:disable-next-line:no-console
    console.log("Logger#sendToLoggingService sendng", JSON.stringify(data), "to", logManagerUrl);
  }
  const request = new XMLHttpRequest();
  request.open("POST", logManagerUrl, true);
  request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
  request.send(JSON.stringify(data));
}
