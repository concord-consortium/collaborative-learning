import { observer } from "mobx-react";
import React, { useEffect, useRef } from "react";
import { DocumentModelType } from "../../models/document/document";
import CloudCheckIcon from "../../assets/icons/cloud-check.svg";
import SyncArrowsIcon from "../../assets/icons/sync-arrows.svg";
import "./save-indicator.scss";

interface IProps {
  document: DocumentModelType;
}

const SAVED_DISPLAY_DURATION = 3000;

export const SaveIndicator = observer(({ document }: IProps) => {
  const { saveState } = document;
  const timerRef = useRef<number>();

  useEffect(() => {
    if (saveState === "saved") {
      timerRef.current = window.setTimeout(() => {
        document.setSaveState("idle");
      }, SAVED_DISPLAY_DURATION);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [document, saveState]);

  const isSyncing = saveState === "saving" || saveState === "retrying";
  const Icon = isSyncing ? SyncArrowsIcon : CloudCheckIcon;
  const text = saveState === "saving" ? "Saving..."
    : saveState === "retrying" ? "Retrying..."
    : saveState === "saved" ? "Saved"
    : undefined;

  return (
    <div className="save-indicator" data-testid="save-indicator">
      <Icon className={`save-indicator-icon${isSyncing ? " syncing" : ""}`} />
      {text && <span className="save-indicator-text">{text}</span>}
    </div>
  );
});
