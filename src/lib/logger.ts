import { v4 as uuid } from "uuid";
import { getSnapshot } from "mobx-state-tree";
import { Optional } from "utility-types";
import { ToolTileModelType } from "../models/tools/tool-tile";
import { IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";
import { InvestigationModelType } from "../models/curriculum/investigation";
import { ProblemModelType } from "../models/curriculum/problem";
import { DocumentModelType } from "../models/document/document";
import { JXGChange } from "../models/tools/geometry/jxg-changes";
import { DrawingToolChange } from "../models/tools/drawing/drawing-content";
import { ITableChange } from "../models/tools/table/table-change";
import { ENavTab } from "../models/view/nav-tabs";
import { DEBUG_LOGGER } from "../lib/debug";

const logManagerUrl = "//cc-log-manager.herokuapp.com/api/logs";

interface LogMessage {
  application: string;
  run_remote_endpoint?: string;
  username: string;
  role: string;
  classHash: string;
  session: string;
  appMode: string;
  investigation?: string;
  problem?: string;
  problemPath: string;
  navTabsOpen: boolean;
  selectedNavTab: string;
  group?: string;
  workspaceMode?: string;
  teacherPanel?: string;
  selectedGroupId?: string;
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
  MOVE_TILE,
  DELETE_TILE,

  VIEW_SHOW_DOCUMENT,
  VIEW_SHOW_COMPARISON_DOCUMENT,
  VIEW_ENTER_FOUR_UP,
  VIEW_ENTER_ONE_UP,
  VIEW_SHOW_COMPARISON_PANEL,
  VIEW_HIDE_COMPARISON_PANEL,
  VIEW_SHOW_SUPPORT,
  VIEW_GROUP,

  CREATE_PERSONAL_DOCUMENT,
  CREATE_LEARNING_LOG,

  SHOW_WORK,
  SHOW_TAB,
  SHOW_TAB_SECTION,
  HIDE_SOLUTIONS,
  SHOW_SOLUTIONS,

  GRAPH_TOOL_CHANGE,
  DRAWING_TOOL_CHANGE,
  TABLE_TOOL_CHANGE,

  TILE_UNDO,
  TILE_REDO,

  PUBLISH_DOCUMENT,
  PUBLISH_SUPPORT,
  DELETE_SUPPORT,

  CREATE_STICKY_NOTE,
  CLOSE_STICKY_NOTES,
  OPEN_STICKY_NOTES,

  // the following are for potential debugging purposes and are all marked "internal"
  INTERNAL_AUTHENTICATED,
  INTERNAL_FIREBASE_DISCONNECTED,
  INTERNAL_NETWORK_STATUS_ALERTED,
  INTERNAL_MONITOR_DOCUMENT,
  INTERNAL_UNMONITOR_DOCUMENT,

  DASHBOARD_SWITCH_CLASS,
  DASHBOARD_SWITCH_PROBLEM,
  DASHBOARD_DESELECT_STUDENT,
  DASHBOARD_SELECT_STUDENT,
  DASHBOARD_TOGGLE_TO_WORKSPACE,
  DASHBOARD_TOGGLE_TO_DASHBOARD
}

type LoggableToolChangeEvent = Optional<JXGChange, "operation"> |
                                Partial<DrawingToolChange> |
                                Optional<ITableChange, "action">;

interface IDocumentInfo {
  type: string;
  key?: string;
  uid?: string;
  title?: string;
  properties?: { [prop: string]: string };
  changeCount?: number;
}

export class Logger {
  public static initializeLogger(stores: IStores, investigation?: InvestigationModelType, problem?: ProblemModelType) {
    if (DEBUG_LOGGER) {
      // eslint-disable-next-line no-console
      console.log("Logger#initializeLogger called.");
    }
    this._instance = new Logger(stores, investigation, problem);
  }

  public static updateProblem(investigation: InvestigationModelType, problem: ProblemModelType) {
    this._instance.problemTitle = problem.title;
    this._instance.investigationTitle = investigation.title;
  }

  public static log(event: LogEventName, parameters?: Record<string, unknown>, method?: LogEventMethod) {
    if (!this._instance) return;

    const eventString = LogEventName[event];
    const logMessage = Logger.Instance.createLogMessage(eventString, parameters, method);
    sendToLoggingService(logMessage, this._instance.stores.user);
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
        documentUid: document.uid,
        documentKey: document.key,
        documentType: document.type,
        documentChanges: document.changeCount
      };

      if (event === LogEventName.COPY_TILE && metaData && metaData.originalTileId) {
        const sourceDocument = Logger.Instance.getDocumentForTile(metaData.originalTileId);
        parameters = {
          ...parameters,
          sourceUsername: sourceDocument.uid,
          sourceObjectId: metaData.originalTileId,
          sourceDocumentKey: sourceDocument.key,
          sourceDocumentType: sourceDocument.type,
          sourceDocumentTitle: sourceDocument.title || "",
          sourceDocumentProperties: sourceDocument.properties || {}
        };
      }
    }

    Logger.log(event, parameters);
  }

  public static logDocumentEvent(event: LogEventName, document: DocumentModelType) {
    const parameters = {
      documentUid: document.uid,
      documentKey: document.key,
      documentType: document.type,
      documentTitle: document.title || "",
      documentProperties: document.properties?.toJSON() || {},
      documentVisibility: document.visibility,
      documentChanges: document.changeCount
    };
    Logger.log(event, parameters);
  }

  public static logToolChange(
    eventName: LogEventName,
    operation: string,
    change: LoggableToolChangeEvent,
    toolId: string,
    method?: LogEventMethod)
  {
    const document = Logger.Instance.getDocumentForTile(toolId);
    const parameters: {[k: string]: any} = {
      toolId,
      operation,
      ...change,
      documentUid: document.uid,
      documentKey: document.key,
      documentType: document.type,
      documentChanges: document.changeCount
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
    const {appConfig, user, problemPath, ui} = this.stores;

    const logMessage: LogMessage = {
      application: appConfig.appName,
      username:  `${user.id}@${user.portal}`,
      role: user.type || "unknown",
      classHash: user.classHash,
      session: this.session,
      appMode: this.stores.appMode,
      investigation: this.investigationTitle,
      problem: this.problemTitle,
      problemPath,
      navTabsOpen: ui.navTabContentShown,
      selectedNavTab: ui.activeNavTab,
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
      logMessage.workspaceMode = ui.problemWorkspace.mode;
    }
    if (user.isTeacher) {
      logMessage.teacherPanel = ui.teacherPanelKey;
      if (ui.activeNavTab === ENavTab.kStudentWork) {
        logMessage.selectedGroupId = ui.activeGroupId;
      }
    }

    return logMessage;
  }

  private getDocumentForTile(tileId: string): IDocumentInfo {
    const document = this.stores.documents.findDocumentOfTile(tileId);
    if (document) {
      const { type, key, uid, title, changeCount, properties } = document;
      return { type, key, uid, title, changeCount, properties: properties && properties.toJSON() || {} };
    } else {
      return {
        type: "Instructions"        // eventually we will need to include copying from supports
      };
    }
  }
}

function sendToLoggingService(data: LogMessage, user: UserModelType) {
  if (DEBUG_LOGGER) {
    // eslint-disable-next-line no-console
    console.log("Logger#sendToLoggingService sending", JSON.stringify(data), "to", logManagerUrl);
  }
  const request = new XMLHttpRequest();

  request.upload.addEventListener("load", () => user.setIsLoggingConnected(true));
  request.upload.addEventListener("error", () => user.setIsLoggingConnected(false));
  request.upload.addEventListener("abort", () => user.setIsLoggingConnected(false));

  request.open("POST", logManagerUrl, true);
  request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
  request.send(JSON.stringify(data));
}
