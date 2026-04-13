import { observer } from "mobx-react";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DocumentModelType } from "../../models/document/document";
import { useSaveIndicatorPortal } from "./save-indicator-portal-context";
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
  const portalRef = useSaveIndicatorPortal();

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

  const content = (
    <div className="save-indicator" data-testid="save-indicator">
      {text && <span className="save-indicator-text">{text}</span>}
      <Icon className={`save-indicator-icon${isSyncing ? " syncing" : ""}`} />
    </div>
  );

  if (portalRef.current) {
    return createPortal(content, portalRef.current);
  }
  return content;
});
