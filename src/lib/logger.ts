import { v4 as uuid } from "uuid";
import { getSnapshot } from "mobx-state-tree";
import { Optional } from "utility-types";
import { ITileModel } from "../models/tiles/tile-model";
import { IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";
import { InvestigationModelType } from "../models/curriculum/investigation";
import { ProblemModelType } from "../models/curriculum/problem";
import { JXGChange } from "../models/tiles/geometry/jxg-changes";
import { ITableChange } from "../models/tiles/table/table-change";
import { ENavTab } from "../models/view/nav-tabs";
import { DEBUG_LOGGER } from "../lib/debug";
import { timeZoneOffsetString } from "../utilities/js-utils";

type LoggerEnvironment = "dev" | "production";

const logManagerUrl: Record<LoggerEnvironment, string> = {
  dev: "//cc-log-manager-dev.herokuapp.com/api/logs",
  production: "//cc-log-manager.herokuapp.com/api/logs"
};

const productionPortal = "learn.concord.org";

type AnyRecord = Record<string, any>;
type LogEventParamsCallback = (params: AnyRecord, context: AnyRecord) => AnyRecord;

interface LogMessage {
  // these top-level properties are treated specially by the log-ingester:
  // https://github.com/concord-consortium/log-ingester/blob/a8b16fdb02f4cef1f06965a55c5ec6c1f5d3ae1b/canonicalize.js#L3
  application: string;
  activity?: string;
  event: string;
  // event_value: string; // not currently used in CLUE but available if another top-level field were required
  run_remote_endpoint?: string;
  session: string;
  username: string;

  // the rest of the properties are packaged into `extras` by the log-ingester
  role: string;
  classHash: string;
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
  method: string;
  disconnects?: string;
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
  TEXT_TOOL_CHANGE,
  DATAFLOW_TOOL_CHANGE,

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
  EXPAND_COMMENT_THREAD_FOR_DOCUMENT,
  EXPAND_COMMENT_THREAD_FOR_TILE,
  COLLAPSE_COMMENT_THREAD_FOR_DOCUMENT,
  COLLAPSE_COMMENT_THREAD_FOR_TILE,
  CHAT_PANEL_HIDE,
  CHAT_PANEL_SHOW,

  // the following are for potential debugging purposes and are all marked "internal"
  INTERNAL_AUTHENTICATED,
  INTERNAL_ERROR_ENCOUNTERED,
  INTERNAL_TEST_EVENT,

  DASHBOARD_SWITCH_CLASS,
  DASHBOARD_SWITCH_PROBLEM,
  DASHBOARD_DESELECT_STUDENT,
  DASHBOARD_SELECT_STUDENT,
  DASHBOARD_TOGGLE_TO_WORKSPACE,
  DASHBOARD_TOGGLE_TO_DASHBOARD,

  TEACHER_NETWORK_EXPAND_DOCUMENT_SECTION,
  TEACHER_NETWORK_COLLAPSE_DOCUMENT_SECTION,

  HISTORY_SHOW_CONTROLS,
  HISTORY_HIDE_CONTROLS,
  HISTORY_PLAYBACK_START,
  HISTORY_PLAYBACK_STOP,
  HISTORY_PLAYBACK_SEEK
}

// This is the form the log events take
export interface SimpleTileLogEvent {
  path?: string;
  args?: Array<any>;
}

export interface DataflowProgramChange extends AnyRecord {
  targetType: string,
  nodeTypes?: string[],
  nodeIds?: number[],
}

type LoggableTileChangeEvent =  Optional<JXGChange, "operation"> |
                                SimpleTileLogEvent |
                                Optional<ITableChange, "action"> |
                                DataflowProgramChange;

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

export class Logger {
  public static isLoggingEnabled = false;

  private static eventTypes = new Map<string, LogEventParamsCallback>();

  public static registerEventType(eventType: string, callback: LogEventParamsCallback) {
    this.eventTypes.set(eventType, callback);
  }

  public static eventTypeParams(eventType: string, params: AnyRecord) {
    const callback = this.eventTypes.get(eventType);
    return callback?.(params, { user: this._instance.stores.user }) ?? params;
  }

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

  // log an event that was previously registered
  public static logEvent(eventType: string, event: LogEventName, _params: AnyRecord) {
    let _eventType: string | undefined = eventType;
    let params = { ..._params };
    do {
      const callback = _eventType ? this.eventTypes.get(_eventType) : undefined;
      if (callback) {
        const { nextEventType, ...others } = callback(params, this._instance.stores);
        _eventType = nextEventType as string | undefined;
        params = others;
      }
    } while(_eventType);
    this.log(event, params);
  }

  public static logTileEvent(event: LogEventName, tile?: ITileModel, metaData?: TileLoggingMetadata,
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

  public static logTileChange(
    eventName: LogEventName,
    operation: string,
    change: LoggableTileChangeEvent,
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
    const {
      appConfig: { appName }, appMode, problemPath,
      ui: { activeGroupId, activeNavTab, navTabContentShown, problemWorkspace, teacherPanelKey },
      user: { activityUrl, classHash, id, isStudent, isTeacher, portal, type, latestGroupId,
              loggingRemoteEndpoint, firebaseDisconnects, loggingDisconnects, networkStatusAlerts
    }} = this.stores;
    // only log disconnect counts if there have been any disconnections
    const totalDisconnects = firebaseDisconnects + loggingDisconnects + networkStatusAlerts;
    const disconnects = totalDisconnects
                          ? { disconnects: `${firebaseDisconnects}/${loggingDisconnects}/${networkStatusAlerts}` }
                          : undefined;
    const logMessage: LogMessage = {
      application: appName,
      activity: activityUrl,
      username: `${id}@${portal}`,
      role: type || "unknown",
      classHash,
      session: this.session,
      appMode,
      investigation: this.investigationTitle,
      problem: this.problemTitle,
      problemPath,
      navTabsOpen: navTabContentShown,
      selectedNavTab: activeNavTab,
      time: Date.now(),       // eventually we will want server skew (or to add this via FB directly)
      tzOffset: timeZoneOffsetString(),
      event,
      method,
      ...disconnects,
      parameters
    };

    if (loggingRemoteEndpoint) {
      logMessage.run_remote_endpoint = loggingRemoteEndpoint;
    }

    if (isStudent) {
      logMessage.group = latestGroupId;
      logMessage.workspaceMode = problemWorkspace.mode;
    }
    if (isTeacher) {
      logMessage.teacherPanel = teacherPanelKey;
      if (activeNavTab === ENavTab.kStudentWork) {
        logMessage.selectedGroupId = activeGroupId;
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
    console.log("Logger#sendToLoggingService sending", data, "to", logManagerUrl);
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
