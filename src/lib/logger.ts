import { v4 as uuid } from "uuid";
import { LogEventMethod, LogEventName } from "./logger-types";
import { IStores } from "../models/stores/stores";
import { UserModelType } from "../models/stores/user";
import { ENavTab } from "../models/view/nav-tabs";
import { debugLog, DEBUG_LOGGER } from "../lib/debug";
import { timeZoneOffsetString } from "../utilities/js-utils";

type LoggerEnvironment = "dev" | "production";

const logManagerUrl: Record<LoggerEnvironment, string> = {
  dev: "https://logger.concordqa.org/logs",
  production: "https://logger.concord.org/logs"
};

const productionPortal = "learn.concord.org";

export interface LogMessage {
  // these top-level properties are treated specially by the log-ingester:
  // https://github.com/concord-consortium/log-ingester/blob/a8b16fdb02f4cef1f06965a55c5ec6c1f5d3ae1b/canonicalize.js#L3
  application: string;
  activity?: string;
  event: string;
  // event_value: string; // not currently used in CLUE but available if another top-level field were required
  run_remote_endpoint?: string;
  session: string;
  username: string;

  parameters: any;

  // the rest of the properties are packaged into `extras` by the log-ingester
  role: string;
  classHash: string;
  appMode: string;
  investigation?: string;
  problem?: string;
  problemPath: string;
  navTabsOpen: boolean;
  selectedNavTab: string|undefined;
  group?: string;
  workspaceMode?: string;
  teacherPanel?: string;
  selectedGroupId?: string;
  time: number;
  tzOffset: string;
  method: string;
  disconnects?: string;
  offeringId: string;
}

// List of log messages that were generated before a Logger is initialized;
// will be sent when possible.
interface PendingMessage {
  time: number;
  event: LogEventName;
  parameters?: Record<string, unknown>;
  method?: LogEventMethod;
}

type ILogListener = (logMessage: LogMessage) => void;

export class Logger {
  public static isLoggingEnabled = false;
  private static _instance: Logger;
  private static pendingMessages: PendingMessage[] = [];

  // `appContext` properties are logged with every event
  public static initializeLogger(stores: IStores, appContext?: Record<string, any>) {
    const { appMode, user } = stores;
    const logModes: Array<typeof appMode> = ["authed"];
    this.isLoggingEnabled = (logModes.includes(appMode) || DEBUG_LOGGER) && !user.isResearcher;

    debugLog(DEBUG_LOGGER, "Logger#initializeLogger called.");

    this._instance = new Logger(stores, appContext);
    this.sendPendingMessages();
  }

  public static updateAppContext(appContext: Record<string, any>) {
    Object.assign(this._instance.appContext, appContext);
  }

  public static log(event: LogEventName, parameters?: Record<string, unknown>, method?: LogEventMethod) {
    const time = Date.now(); // eventually we will want server skew (or to add this via FB directly)
    if (this._instance) {
      this._instance.formatAndSend(time, event, parameters, method);
    } else {
      debugLog(DEBUG_LOGGER, "Queueing log message for later delivery", LogEventName[event]);
      this.pendingMessages.push({ time, event, parameters, method });
    }
  }

  private static sendPendingMessages() {
    if (!this._instance) return;
    for (const message of this.pendingMessages) {
      this._instance.formatAndSend(message.time, message.event, message.parameters, message.method);
    }
    this.pendingMessages = [];
  }

  public static get Instance() {
    if (this._instance) {
      return this._instance;
    }
    throw new Error("Logger not initialized yet.");
  }

  public static get stores() {
    return this._instance?.stores;
  }

  private stores: IStores;
  private appContext: Record<string, any> = {};
  private session: string;
  private logListeners: ILogListener[] = [];

  private constructor(stores: IStores, appContext = {}) {
    this.stores = stores;
    this.appContext = appContext;
    this.session = uuid();
  }

  public registerLogListener(listener: ILogListener) {
    this.logListeners.push(listener);
  }

  private formatAndSend(time: number,
      event: LogEventName, parameters?: Record<string, unknown>, method?: LogEventMethod) {
    const eventString = LogEventName[event];
    const logMessage = this.createLogMessage(time, eventString, parameters, method);
    sendToLoggingService(logMessage, this.stores.user);
    for (const listener of this.logListeners) {
      listener(logMessage);
    }
  }

  private createLogMessage(
    time: number,
    event: string,
    parameters?: {section?: string},
    method: LogEventMethod = LogEventMethod.DO
  ): LogMessage {
    const {
      appConfig: { appName }, appMode, problemPath,
      studentWorkTabSelectedGroupId,
      persistentUI: { activeNavTab, navTabContentShown, problemWorkspace, teacherPanelKey },
      user: { activityUrl, classHash, id, isStudent, isTeacher, portal, type, currentGroupId,
              loggingRemoteEndpoint, firebaseDisconnects, loggingDisconnects, networkStatusAlerts
      },
      portal: { offeringId },
  } = this.stores;
    // only log disconnect counts if there have been any disconnections
    const totalDisconnects = firebaseDisconnects + loggingDisconnects + networkStatusAlerts;
    const disconnects = totalDisconnects
                          ? { disconnects: `${firebaseDisconnects}/${loggingDisconnects}/${networkStatusAlerts}` }
                          : undefined;

    const logMessage: LogMessage = {
      application: appName,
      activity: activityUrl,
      offeringId,
      username: `${id}@${portal}`,
      role: type || "unknown",
      classHash,
      session: this.session,
      appMode,
      ...this.appContext,
      problemPath,
      navTabsOpen: navTabContentShown,
      selectedNavTab: activeNavTab,
      time,
      tzOffset: timeZoneOffsetString(),
      event,
      method,
      ...disconnects,
      parameters,
    };

    if (loggingRemoteEndpoint) {
      logMessage.run_remote_endpoint = loggingRemoteEndpoint;
    }

    if (isStudent) {
      logMessage.group = currentGroupId;
      logMessage.workspaceMode = problemWorkspace.mode;
    }
    if (isTeacher) {
      logMessage.teacherPanel = teacherPanelKey;
      if (activeNavTab === ENavTab.kStudentWork) {
        logMessage.selectedGroupId = studentWorkTabSelectedGroupId;
      }
    }

    return logMessage;
  }

}

function sendToLoggingService(data: LogMessage, user: UserModelType) {
  const isProduction = user.portal === productionPortal || data.parameters?.portal === productionPortal;
  const url = logManagerUrl[isProduction ? "production" : "dev"];
  debugLog(DEBUG_LOGGER, "Logger#sendToLoggingService sending", data, "to", url);
  if (!Logger.isLoggingEnabled) return;

  const request = new XMLHttpRequest();

  request.upload.addEventListener("load", () => user.setIsLoggingConnected(true));
  request.upload.addEventListener("error", () => user.setIsLoggingConnected(false));
  request.upload.addEventListener("abort", () => user.setIsLoggingConnected(false));

  request.open("POST", url, true);
  request.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
  request.send(JSON.stringify(data));
}

// Add the logger to the window in Cypress so we can stub it
if (typeof window !== "undefined") {
  const aWindow = window as any;
  if (aWindow.Cypress) {
    aWindow.ccLogger = Logger;
  }
}
