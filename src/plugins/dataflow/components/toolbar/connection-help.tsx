import React, { useEffect, useId, useRef } from "react";
import { observer } from "mobx-react";
import { LogEventName } from "../../../../lib/logger-types";
import { logTileChangeEvent } from "../../../../models/tiles/log/log-tile-change-event";
import { helpTries, kHelpSuccessLine, problemHeadline } from "../../model/connect-failures";
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
 * they were opened.
 */
export const ConnectionHelp = observer(function ConnectionHelp({ connection, onClosed }: IConnectionHelpProps) {
  const { help } = connection;
  const titleId = useId();
  const detailsId = useId();
  const titleRef = useRef<HTMLDivElement>(null);

  // Only the opening from Help asks for focus, so a palette opened with help already showing keeps
  // focus on its first control.
  useEffect(() => {
    if (connection.takeHelpFocusRequest()) titleRef.current?.focus({ preventScroll: true });
  }, [connection, help]);

  if (!help) return null;
  const { shown, detailsExpanded } = help;

  function close() {
    logConnectHelp(shown.tileId, "hideConnectHelp", { kind: shown.kind, trigger: "close" });
    connection.closeHelp();
    onClosed();
  }

  return (
    <section className="connection-help" role="region" aria-labelledby={titleId}>
      <div className="connection-help-top">
        <div className="connection-help-header">
          <div className="connection-help-title" id={titleId} ref={titleRef} tabIndex={-1}>
            Connection help
          </div>
          <PaletteControl className="connection-help-close" label="Close connection help" text="✕"
              disabled={false} onActivate={close} />
        </div>
        <div role="status" aria-live="polite" />
      </div>
      <div className="connection-help-body">
        <div className="connection-help-steps">
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
