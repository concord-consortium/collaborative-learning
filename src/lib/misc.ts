import { IStores } from "../models/stores/stores";
import { Logger } from "./logger";

function setPageTitle(stores: IStores) {
  const { appConfig, showDemoCreator, unit, problem } = stores;
  const pageTitleTemplate = appConfig && appConfig.pageTitle;
  let pageTitle;
  if (pageTitleTemplate) {
    pageTitle = pageTitleTemplate
                  .replace("%unitTitle%", unit && unit.fullTitle || "")
                  .replace("%problemTitle%", problem && problem.fullTitle || "");
  }
  document.title = showDemoCreator
                    ? `CLUE: Demo Creator`
                    : (pageTitle || document.title);
}

function initRollbar(stores: IStores, problemId: string) {
  const {user, unit, gitInfo} = stores;
  const portal = user.portal ?? "unauthenticated";
  if (typeof (window as any).Rollbar !== "undefined") {
    const _Rollbar = (window as any).Rollbar;
    if (_Rollbar.configure) {
      const config = {
        maxItems: 100,
        stackTraceLimit: 50,
        payload: {
          class: user.classHash,
          context: `${unit.code} ${problemId}`,
          offering: user.offeringId,
          person: {
            id: `${user.id}@${portal}`
          },
          problemId: problemId || "",
          problem: stores.problem.title,
          role: user.type,
          unit: unit.title,
          code_version: gitInfo?.gitSha,
          version_tag: gitInfo?.tag
        }
      };
      _Rollbar.configure(config);
    }
  }
}

export function problemLoaded(stores: IStores, problemId: string) {
  setPageTitle(stores);
  initRollbar(stores, problemId);

  // The logger will only be enabled if the appMode is "authed", or DEBUG_LOGGER is true
  Logger.initializeLogger(stores, { investigation: stores.investigation.title, problem: stores.problem.title });

  // Send event logs to rollbar as well
  Logger.Instance?.registerLogListener((logMessage) => {
    (window as any).Rollbar?.captureEvent(logMessage, 'info');
  });
}
