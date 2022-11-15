import { v4 as uuid } from "uuid";
import { LogEventMethod, LogEventName } from "./logger-types";
import { IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";
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
type UnknownRecord = Record<string, any>;
type LogEventParamsCallback = (params: AnyRecord, context: UnknownRecord) => AnyRecord;

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

export class Logger {
  public static isLoggingEnabled = false;

  /*
    Previously, there were a number of application-specific logging methods that encapsulated
    application-specific domain knowledge, e.g. `logTileEvent`, `logHistoryEvent`, etc.
    This inherently makes the `Logger` application-specific rather than sharable. Instead, we
    introduce the notion of client-defined event types which are registered by clients along
    with a callback whose job it is to convert the arguments provided to the logging function
    to the parameters that will be logged as part of the event. This allows all of the domain
    knowledge to remain isolated to the client, allowing the `Logger` itself to be generic and
    therefore sharable across applications. For instance, the `logDocumentEvent` function
    converts a `DocumentModel` to a set of document metadata properties for logging.

    If the parameters returned from one of these logging event callbacks includes the
    `nextEventType` property, then the parameters returned from the original callback will be
    passed to the specified `nextEventType` callback, which allows these parameter transformation
    callbacks to be chained.
   */

  private static eventTypes = new Map<string, LogEventParamsCallback>();

  public static registerEventType(eventType: string, callback: LogEventParamsCallback) {
    this.eventTypes.set(eventType, callback);
  }

  // `appContext` properties are logged with every event
  public static initializeLogger(stores: IStores, appContext?: Record<string, any>) {
    const { appMode } = stores;
    const logModes: Array<typeof appMode> = ["authed"];
    this.isLoggingEnabled = logModes.includes(appMode) || DEBUG_LOGGER;

    if (DEBUG_LOGGER) {
      // eslint-disable-next-line no-console
      console.log("Logger#initializeLogger called.");
    }
    this._instance = new Logger(stores, appContext);
  }

  public static updateAppContext(appContext: Record<string, any>) {
    Object.assign(this._instance.appContext, appContext);
  }

  public static log(event: LogEventName, parameters?: Record<string, unknown>, method?: LogEventMethod) {
    if (!this._instance) return;

    const eventString = LogEventName[event];
    const logMessage = Logger.Instance.createLogMessage(eventString, parameters, method);
    sendToLoggingService(logMessage, this._instance.stores.user);
  }

  // log an event of a previously registered event type
  public static logEvent(eventType: string, event: LogEventName, _params: AnyRecord) {
    let _eventType: string | undefined = eventType;
    let params = { ..._params };
    do {
      const callback = _eventType ? this.eventTypes.get(_eventType) : undefined;
      if (callback) {
        // stores are passed to the callback but not typed as such so the callbacks only depend
        // on the store properties that are used rather than the stores object as a whole.
        const { nextEventType, ...others } = callback(params, this._instance.stores as unknown as UnknownRecord);
        _eventType = nextEventType as string | undefined;
        params = others;
      }
      // chain to the next event type if one is specified
    } while(_eventType);
    this.log(event, params, _params.method);
  }

  private static _instance: Logger;

  public static get Instance() {
    if (this._instance) {
      return this._instance;
    }
    throw new Error("Logger not initialized yet.");
  }

  private stores: IStores;
  private appContext: Record<string, any> = {};
  private session: string;

  private constructor(stores: IStores, appContextProps = {}) {
    this.stores = stores;
    this.appContext = appContextProps;
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
      ...this.appContext,
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
