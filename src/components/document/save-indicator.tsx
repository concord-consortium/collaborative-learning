import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DocumentModelType, SaveState } from "../../models/document/document";
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
    if (saveState === SaveState.Saved) {
      timerRef.current = window.setTimeout(() => {
        document.setSaveState(SaveState.Idle);
      }, SAVED_DISPLAY_DURATION);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [document, saveState]);

  const isSyncing = saveState === SaveState.Saving || saveState === SaveState.Retrying;
  const Icon = isSyncing ? SyncArrowsIcon : CloudCheckIcon;
  const text = saveState === SaveState.Saving ? "Saving..."
    : saveState === SaveState.Retrying ? "Retrying..."
    : saveState === SaveState.Saved ? "Saved"
    : undefined;

  const content = (
    <div className="save-indicator" data-testid="save-indicator">
      {text && <span className="save-indicator-text">{text}</span>}
      <Icon className={classNames("save-indicator-icon", { syncing: isSyncing })} />
    </div>
  );

  if (portalRef.current) {
    return createPortal(content, portalRef.current);
  }
  return content;
});
