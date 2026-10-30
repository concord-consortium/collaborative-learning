import React, { useEffect, useId, useRef } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { useStores } from "../../../../hooks/use-stores";
import { LogEventName } from "../../../../lib/logger-types";
import { IDrawerPanel, UIModelType } from "../../../../models/stores/ui";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { helpHeadline, helpTries, kDeviceChoiceLabels, kHelpSuccessLine } from "../../model/connect-failures";
import { DeviceConnection, getDeviceConnection, HelpNotice, IHelpTopic } from "../../model/device-connection";
import { connectionStatusInput, connectPaneStatus } from "../../utilities/connect-pane-status";

import "./connection-help-panel.scss";

type HelpOperation = "showConnectHelp" | "hideConnectHelp" | "connectHelpNotice";

// Logs from the tile the help was opened from, even after that tile is deleted.
function logConnectHelp(tileId: string, operation: HelpOperation, details: object) {
  logTileChangeEvent(LogEventName.DATAFLOW_TOOL_CHANGE, {
    tileId, operation, change: { targetType: "connectHelp", ...details }
  });
}

function logNotice(tileId: string, notice: HelpNotice, action: "shown" | "clicked") {
  const kind = notice.type === "differentProblem" ? { kind: notice.topic.kind } : {};
  logConnectHelp(tileId, "connectHelpNotice", { notice: notice.type, ...kind, action });
}

function lowercaseFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// Closing the help removes the focused control, so focus goes back to where the help was opened
// from: More… if the pane still shows it, otherwise the connect button.
function focusHelpOpener() {
  const opener = document.querySelector<HTMLElement>(".dataflow-connect-pane .connect-more")
    ?? document.querySelector<HTMLElement>("button.toolbar-button.connect");
  opener?.focus();
}

/**
 * The Connection help in the right drawer. Its headline, steps and Details stay as they were
 * opened; only the status lines at the top follow the connection, and a notice says when the
 * problem has changed.
 */
export const ConnectionHelpPanel = observer(function ConnectionHelpPanel({ onClose }: { onClose: () => void }) {
  const { serialDevice } = useStores();
  const connection = getDeviceConnection(serialDevice);
  const { help } = connection;
  const headingId = useId();
  const detailsId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (connection.takeHelpFocusRequest()) headingRef.current?.focus();
  }, [connection, help]);

  if (!help) return null;
  const { shown, notice, detailsExpanded } = help;
  const label = kDeviceChoiceLabels[shown.choice];
  const { line1, line2 } = connectPaneStatus(connectionStatusInput(connection, connection.lastFailure));

  function close(trigger: "close" | "closeHelp") {
    logConnectHelp(shown.tileId, "hideConnectHelp", { kind: shown.kind, trigger });
    connection.closeHelp();
    onClose();
    focusHelpOpener();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    e.preventDefault();
    close("close");
  }

  function closeFromNotice() {
    if (notice) logNotice(shown.tileId, notice, "clicked");
    close("closeHelp");
  }

  // The notice's button goes away with the notice, so focus moves to the heading above the new steps.
  function showNoticeTopic() {
    if (notice) logNotice(shown.tileId, notice, "clicked");
    connection.showNoticeTopic();
    headingRef.current?.focus();
  }

  return (
    <section className="connection-help" role="complementary" aria-labelledby={headingId}
        onKeyDown={handleKeyDown}>
      <header className="connection-help-header">
        <h2 className="connection-help-title" id={headingId} ref={headingRef} tabIndex={-1}>
          {label} connection
        </h2>
        <button type="button" className="connection-help-close" aria-label="Close connection help"
            onClick={() => close("close")}>
          ✕
        </button>
      </header>
      <div className="connection-help-body">
        <div className="connection-help-status">
          <div className="connection-help-status-line">{line1}</div>
          <div className={classNames("connection-help-status-line", line2?.tone)}>{line2?.text}</div>
        </div>
        <div role="status" aria-live="polite">
          {notice?.type === "working" &&
            <div className="connection-help-notice working">
              <span><strong>{"It's working now."}</strong> The {connection.label ?? label} is sending data.</span>
              <button type="button" onClick={closeFromNotice}>Close help</button>
            </div>}
          {notice?.type === "differentProblem" &&
            <div className="connection-help-notice different-problem">
              <span>
                <strong>Something else went wrong:</strong>{" "}
                {lowercaseFirst(helpHeadline(notice.topic.kind, notice.topic.choice))}
              </span>
              <button type="button" onClick={showNoticeTopic}>Show steps for this</button>
            </div>}
          {notice?.type === "unplugged" &&
            <div className="connection-help-notice not-connected">
              <span>
                <strong>The {connection.label ?? label} was unplugged.</strong> Plug it back in and click Connect.
              </span>
            </div>}
          {notice?.type === "notConnected" &&
            <div className="connection-help-notice not-connected">
              <span>
                <strong>{`The ${connection.label ?? label} isn't connected.`}</strong> Click Connect to try again.
              </span>
            </div>}
        </div>
        <div className={classNames("connection-help-steps", { faded: notice?.type === "working" })}>
          <p className="connection-help-headline">{helpHeadline(shown.kind, shown.choice)}</p>
          <p>{kHelpSuccessLine}</p>
          <ol>
            {helpTries(shown.kind, shown.choice).map(({ stillNotWorking, text }) => (
              <li key={text}>{stillNotWorking && <><em>Still not working?</em> </>}{text}</li>
            ))}
          </ol>
        </div>
        <div className="connection-help-details">
          <button type="button" className="connection-help-details-toggle" aria-expanded={detailsExpanded}
              aria-controls={detailsId} onClick={() => connection.toggleHelpDetails()}>
            Details
          </button>
          {detailsExpanded && <p id={detailsId} className="connection-help-details-text">{shown.details}</p>}
        </div>
      </div>
    </section>
  );
});

export const kConnectionHelpPanel: IDrawerPanel = {
  id: "connectionHelp",
  tabLabel: "Connection help",
  Component: ConnectionHelpPanel
};

interface IOpenConnectionHelp {
  connection: DeviceConnection;
  ui: UIModelType;
  topic: IHelpTopic;
}

// Shows the help for `topic` in the right drawer, in place of any help already showing.
export function openConnectionHelp({ connection, ui, topic }: IOpenConnectionHelp) {
  connection.openHelp(topic, { onNotice: notice => logNotice(topic.tileId, notice, "shown") });
  ui.openDrawerPanel(kConnectionHelpPanel);
  logConnectHelp(topic.tileId, "showConnectHelp", { kind: topic.kind });
}
