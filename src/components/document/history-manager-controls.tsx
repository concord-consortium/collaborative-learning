import React from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { FirestoreHistoryManagerConcurrent } from "../../models/history/firestore-history-manager-concurrent";

interface IHistoryManagerControlsProps {
  manager: FirestoreHistoryManagerConcurrent;
}

export const HistoryManagerControls: React.FC<IHistoryManagerControlsProps> = observer(({ manager }) => {
  return (
    <div className="history-manager-controls">
      {manager.resumeCountdownSeconds !== null ? (
        <>
          <button disabled>Pause Uploads</button>
          <span className="history-manager-status">
            Resuming in {manager.resumeCountdownSeconds}s…
          </span>
        </>
      ) : manager.paused ? (
        <button onClick={() => manager.resumeUploadsAfterDelay(5000)}>
          Resume After 5s
        </button>
      ) : (
        <button onClick={() => manager.pauseUploads()}>
          Pause Uploads
        </button>
      )}
      <button
        className={classNames({ paused: manager.pausedDownloads })}
        onClick={() => manager.pausedDownloads
          ? manager.resumeDownloads()
          : manager.pauseDownloads()}
      >
        {manager.pausedDownloads ? "Resume Downloads" : "Pause Downloads"}
      </button>
    </div>
  );
});
