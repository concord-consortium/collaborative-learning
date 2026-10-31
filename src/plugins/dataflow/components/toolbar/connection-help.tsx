import React, { useEffect, useId, useRef } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { LogEventName } from "../../../../lib/logger-types";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { helpTries, kDeviceChoiceLabels, kHelpSuccessLine, problemHeadline } from "../../model/connect-failures";
import { DeviceConnection, HelpNotice, IHelpTopic } from "../../model/device-connection";
import { PaletteControl } from "./palette-control";

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

// Shows the help for `topic`, in place of any help already showing.
export function openConnectionHelp(connection: DeviceConnection, topic: IHelpTopic) {
  connection.openHelp(topic, { onNotice: notice => logNotice(topic.tileId, notice, "shown") });
  logConnectHelp(topic.tileId, "showConnectHelp", { kind: topic.kind });
}

interface IConnectionHelpProps {
  connection: DeviceConnection;
  // Called after the help closes, to move focus off the control that closed it.
  onClosed: () => void;
}

/**
 * The Connection help, a column in the connect palette. Its headline, steps and Details stay as
 * they were opened; a notice says when the problem has changed. The help stays until the student
 * closes it, however many times the palette closes and opens.
 */
export const ConnectionHelp = observer(function ConnectionHelp({ connection, onClosed }: IConnectionHelpProps) {
  const { help } = connection;
  const titleId = useId();
  const detailsId = useId();
  const titleRef = useRef<HTMLDivElement>(null);

  // The request is taken once, so the title takes focus only when Help opens the help. Without it,
  // the title would take focus again on every later replacement of `help`, such as a Details toggle
  // or a notice appearing. A palette opened with help already showing lands on its first control,
  // since the palette's own mount effect runs after this one.
  useEffect(() => {
    if (connection.takeHelpFocusRequest()) titleRef.current?.focus({ preventScroll: true });
  }, [connection, help]);

  if (!help) return null;
  const { shown, notice, detailsExpanded } = help;
  const label = connection.label ?? kDeviceChoiceLabels[shown.choice];

  function close(trigger: "close" | "closeHelp") {
    logConnectHelp(shown.tileId, "hideConnectHelp", { kind: shown.kind, trigger });
    connection.closeHelp();
    onClosed();
  }

  function closeFromNotice() {
    if (notice) logNotice(shown.tileId, notice, "clicked");
    close("closeHelp");
  }

  // The notice's button goes away with the notice, so focus moves to the title above the new steps.
  function showNoticeTopic() {
    if (notice) logNotice(shown.tileId, notice, "clicked");
    connection.showNoticeTopic();
    titleRef.current?.focus({ preventScroll: true });
  }

  return (
    <section className="connection-help" role="region" aria-labelledby={titleId}>
      <div className="connection-help-top">
        <div className="connection-help-header">
          <div className="connection-help-title" id={titleId} ref={titleRef} tabIndex={-1}>
            Connection help
          </div>
          <PaletteControl className="connection-help-close" label="Close connection help" text="✕"
              disabled={false} onActivate={() => close("close")} />
        </div>
        <div role="status" aria-live="polite">
          {notice?.type === "working" &&
            <div className="connection-help-notice working">
              <span><strong>{"It's working now."}</strong> The {label} is sending data.</span>
              <PaletteControl text="Close help" disabled={false} onActivate={closeFromNotice} />
            </div>}
          {notice?.type === "differentProblem" &&
            <div className="connection-help-notice different-problem">
              <span>
                <strong>Something else went wrong:</strong>{" "}
                {lowercaseFirst(problemHeadline(notice.topic.kind, notice.topic.choice))}
              </span>
              <PaletteControl text="Show steps for this" disabled={false} onActivate={showNoticeTopic} />
            </div>}
          {notice?.type === "updating" &&
            <div className="connection-help-notice updating">
              <span><strong>The update is going again.</strong> Keep the {label} plugged in.</span>
            </div>}
          {notice?.type === "unplugged" &&
            <div className="connection-help-notice not-connected">
              <span><strong>The {label} was unplugged.</strong> Plug it back in and click Connect.</span>
            </div>}
          {notice?.type === "notConnected" &&
            <div className="connection-help-notice not-connected">
              <span><strong>{`The ${label} isn't connected.`}</strong> Click Connect to try again.</span>
            </div>}
        </div>
      </div>
      <div className="connection-help-body">
        <div className={classNames("connection-help-steps", { faded: notice?.type === "working" })}>
          <p className="connection-help-headline">{problemHeadline(shown.kind, shown.choice)}</p>
          <p>{kHelpSuccessLine}</p>
          <ol>
            {helpTries(shown.kind, shown.choice).map(({ stillNotWorking, text }) => (
              <li key={text}>{stillNotWorking && <><em>Still not working?</em> </>}{text}</li>
            ))}
          </ol>
        </div>
        <div className="connection-help-details">
          <PaletteControl className="connection-help-details-toggle" text="Details" disabled={false}
              expanded={detailsExpanded} controls={detailsId} onActivate={() => connection.toggleHelpDetails()} />
          {detailsExpanded && <p id={detailsId} className="connection-help-details-text">{shown.details}</p>}
        </div>
      </div>
    </section>
  );
});
