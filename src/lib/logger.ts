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
import { DrawingToolChange } from "../models/tools/drawing/drawing-types";
import { ITableChange } from "../models/tools/table/table-change";
import { ENavTab } from "../models/view/nav-tabs";
import { DEBUG_LOGGER } from "../lib/debug";
import { isSectionPath, parseSectionPath } from "../../functions/src/shared";
import { timeZoneOffsetString } from "../utilities/js-utils";

type LoggerEnvironment = "dev" | "production";

const logManagerUrl: Record<LoggerEnvironment, string> = {
  dev: "//cc-log-manager-dev.herokuapp.com/api/logs",
  production: "//cc-log-manager.herokuapp.com/api/logs"
};

const productionPortal = "learn.concord.org";

interface LogMessage {
  application: string;
  activityUrl?: string;
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
  tzOffset: string;
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
  VIEW_SHOW_TEACHER_NETWORK_COMPARISON_DOCUMENT,
  VIEW_ENTER_FOUR_UP,
  VIEW_ENTER_ONE_UP,
  VIEW_FOUR_UP_RESIZED,
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

  ADD_INITIAL_COMMENT_FOR_DOCUMENT,
  ADD_INITIAL_COMMENT_FOR_TILE,
  ADD_RESPONSE_COMMENT_FOR_DOCUMENT,
  ADD_RESPONSE_COMMENT_FOR_TILE,
  DELETE_COMMENT_FOR_DOCUMENT,
  DELETE_COMMENT_FOR_TILE,
  CHAT_PANEL_HIDE,
  CHAT_PANEL_SHOW,

  // the following are for potential debugging purposes and are all marked "internal"
  INTERNAL_AUTHENTICATED,
  INTERNAL_ERROR_ENCOUNTERED,
  INTERNAL_FIREBASE_DISCONNECTED,
  INTERNAL_NETWORK_STATUS_ALERTED,
  INTERNAL_MONITOR_DOCUMENT,
  INTERNAL_UNMONITOR_DOCUMENT,

  DASHBOARD_SWITCH_CLASS,
  DASHBOARD_SWITCH_PROBLEM,
  DASHBOARD_DESELECT_STUDENT,
  DASHBOARD_SELECT_STUDENT,
  DASHBOARD_TOGGLE_TO_WORKSPACE,
  DASHBOARD_TOGGLE_TO_DASHBOARD,

  TEACHER_NETWORK_EXPAND_DOCUMENT_SECTION,
  TEACHER_NETWORK_COLLAPSE_DOCUMENT_SECTION,
}

type LoggableToolChangeEvent = Optional<JXGChange, "operation"> |
                                Partial<DrawingToolChange> |
                                Optional<ITableChange, "action">;

interface IDocumentInfo {
  type: string;
  key?: string;
  uid?: string;
  title?: string;
  sectionId?: string;
  properties?: { [prop: string]: string };
  changeCount?: number;
  remoteContext?: string;
}

interface ITeacherNetworkInfo {
  networkClassHash?: string;
  networkUsername?: string;
}

type CommentAction = "add" | "delete";  // | "edit"
export interface ILogComment {
  focusDocumentId: string;
  focusTileId?: string;
  isFirst?: boolean; // only used with "add"
  commentText: string;
  action: CommentAction;
}

export class Logger {
  public static isLoggingEnabled = false;

  public static initializeLogger(stores: IStores, investigation?: InvestigationModelType, problem?: ProblemModelType) {
    const { appMode } = stores;
    const logModes: Array<typeof appMode> = ["authed"];
    this.isLoggingEnabled = logModes.includes(appMode) || DEBUG_LOGGER;

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

  public static logTileEvent(event: LogEventName, tile?: ToolTileModelType, metaData?: TileLoggingMetadata,
    commentText?: string) {
    if (!this._instance) return;

    let parameters = {};

    if (tile) {
      const { uid, key, type, changeCount, sectionId, remoteContext } = Logger.Instance.getTileContext(tile.id);
      const teacherNetworkInfo: ITeacherNetworkInfo | undefined = remoteContext
      ? { networkClassHash: remoteContext,
          networkUsername: `${uid}@${this._instance.stores.user.portal}`}
      : undefined;

      parameters = {
        objectId: tile.id,
        objectType: tile.content.type,
        serializedObject: getSnapshot(tile).content,
        documentUid: uid,
        documentKey: key,
        documentType: type,
        documentChanges: changeCount,
        sectionId,
        commentText,
        ...teacherNetworkInfo
      };

      if (event === LogEventName.COPY_TILE && metaData && metaData.originalTileId) {
        const sourceDocument = Logger.Instance.getTileContext(metaData.originalTileId);
        parameters = {
          ...parameters,
          sourceUsername: sourceDocument.uid,
          sourceObjectId: metaData.originalTileId,
          sourceDocumentKey: sourceDocument.key,
          sourceDocumentType: sourceDocument.type,
          sourceDocumentTitle: sourceDocument.title || "",
          sourceDocumentProperties: sourceDocument.properties || {},
          sourceSectionId: sourceDocument.sectionId
        };
      }
    }

    Logger.log(event, parameters);
  }

  public static logCurriculumEvent(event: LogEventName, curriculum: string, params?: Record<string, any>) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [unit, facet, investigation, problem, section] = parseSectionPath(curriculum) || [];
    // unit, investigation, and problem are already being logged as part of the common log params
    // log the facet and section separately; they're embedded in the path, but could be useful independently
    const parameters = { curriculum, curriculumFacet: facet, curriculumSection: section, ...params };
    Logger.log(event, parameters);
  }

  public static logDocumentEvent(event: LogEventName, document: DocumentModelType, params?: Record<string, any>) {
    const teacherNetworkInfo: ITeacherNetworkInfo | undefined = document.isRemote
        ? { networkClassHash: document.remoteContext,
            networkUsername: `${document.uid}@${this._instance.stores.user.portal}`}
        : undefined;

    const parameters = {
      documentUid: document.uid,
      documentKey: document.key,
      documentType: document.type,
      documentTitle: document.title || "",
      documentProperties: document.properties?.toJSON() || {},
      documentVisibility: document.visibility,
      documentChanges: document.changeCount,
      ...params,
      ...teacherNetworkInfo
    };
    Logger.log(event, parameters);
  }

  public static logCommentEvent({ focusDocumentId, focusTileId, isFirst, commentText, action }: ILogComment) {
    const eventMap: Record<CommentAction, LogEventName> = {
      add: focusTileId
            ? isFirst
                ? LogEventName.ADD_INITIAL_COMMENT_FOR_TILE
                : LogEventName.ADD_RESPONSE_COMMENT_FOR_TILE
            : isFirst
                ? LogEventName.ADD_INITIAL_COMMENT_FOR_DOCUMENT
                : LogEventName.ADD_RESPONSE_COMMENT_FOR_DOCUMENT,
      delete: focusTileId
                ? LogEventName.DELETE_COMMENT_FOR_TILE
                : LogEventName.DELETE_COMMENT_FOR_DOCUMENT
    };
    const event = eventMap[action];

    if (isSectionPath(focusDocumentId)) {
      Logger.logCurriculumEvent(event, focusDocumentId, { tileId: focusTileId, commentText });
    }
    else {
      const document = this._instance.stores.documents.getDocument(focusDocumentId)
                        || this._instance.stores.networkDocuments.getDocument(focusDocumentId);
      if (document) {
        Logger.logDocumentEvent(event,
          document, { tileId: focusTileId, commentText });
      }
      else {
        console.warn("Warning: couldn't log comment event for document:", focusDocumentId);
      }
    }
  }

  public static logToolChange(
    eventName: LogEventName,
    operation: string,
    change: LoggableToolChangeEvent,
    toolId: string,
    method?: LogEventMethod)
  {
    const { uid, key, type, changeCount, sectionId } = Logger.Instance.getTileContext(toolId);
    const parameters: {[k: string]: any} = {
      toolId,
      operation,
      ...change,
      documentUid: uid,
      documentKey: key,
      documentType: type,
      documentChanges: changeCount,
      sectionId
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
      activityUrl: user.activityUrl,
      username: `${user.id}@${user.portal}`,
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
      tzOffset: timeZoneOffsetString(),
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

  private getTileContext(tileId: string): IDocumentInfo {
    const document = this.stores.documents.findDocumentOfTile(tileId)
      || this.stores.networkDocuments.findDocumentOfTile(tileId);
    if (document) {
      const { type, key, uid, title, content, changeCount, remoteContext, properties } = document;
      const sectionId = content?.getSectionIdForTile(tileId);
      return { type, key, uid, title, sectionId, changeCount, remoteContext, properties: properties?.toJSON() || {} };
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
  if (!Logger.isLoggingEnabled) return;

  const request = new XMLHttpRequest();

  request.upload.addEventListener("load", () => user.setIsLoggingConnected(true));
  request.upload.addEventListener("error", () => user.setIsLoggingConnected(false));
  request.upload.addEventListener("abort", () => user.setIsLoggingConnected(false));

  const url = logManagerUrl[user.portal === productionPortal ? "production" : "dev"];
  request.open("POST", url, true);
  request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
  request.send(JSON.stringify(data));
}
