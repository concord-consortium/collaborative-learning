import React, { useEffect, useId, useRef, useState } from "react";
import { DocumentModelType } from "../../models/document/document";
import {
  getSaveStoppedNotice, isRepeatedUnrecordedChange, ISaveStoppedNotice
} from "../../models/document/save-stopped-notice";
import { NotExactReason } from "../../models/history/session-exactness";
import { TreeManagerType } from "../../models/history/tree-manager";

import "./save-stopped-notice.scss";

export interface ISaveStoppedNoticeState {
  reason: NotExactReason;
  notice: ISaveStoppedNotice;
  dismiss: () => void;
}

/**
 * The notice a concurrent document shows once its session stops being exact, until it is dismissed.
 * Call it from an observer, so the notice appears when the session stops being exact.
 */
export function useSaveStoppedNotice(document: DocumentModelType): ISaveStoppedNoticeState | undefined {
  // The component can be kept when its pane shows another document, so a dismissal names its document.
  const [dismissed, setDismissed] = useState<{ document: DocumentModelType, reason: NotExactReason }>();
  const treeManager = document.treeManagerAPI as TreeManagerType | undefined;
  const reason = document.concurrent ? treeManager?.exactness.notExactReason : undefined;
  if (!reason || (dismissed?.document === document && dismissed.reason === reason)) return undefined;
  const repeated = reason === "unrecorded-change" && isRepeatedUnrecordedChange(document.key);
  const notice = getSaveStoppedNotice(reason, repeated);
  return notice && { reason, notice, dismiss: () => setDismissed({ document, reason }) };
}

interface IProps {
  state: ISaveStoppedNoticeState;
}

/**
 * Covers the document, and its toolbar, with the notice. A notice that can't be closed also makes
 * the elements beside it inert, so the keyboard can't reach the document under it.
 */
export const SaveStoppedNotice: React.FC<IProps> = ({ state: { reason, notice, dismiss } }) => {
  const noticeRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const messageId = `${idPrefix}-message`;

  // Moved to the notice so keyboard and screen reader users reach it first.
  useEffect(() => {
    panelRef.current?.focus();
  }, [reason]);

  useEffect(() => {
    const noticeElt = noticeRef.current;
    if (notice.dismissible || !noticeElt?.parentElement) return;
    const siblings = Array.from(noticeElt.parentElement.children)
      .filter((elt): elt is HTMLElement => elt !== noticeElt && elt instanceof HTMLElement);
    siblings.forEach(elt => { elt.inert = true; });
    return () => siblings.forEach(elt => { elt.inert = false; });
  }, [notice.dismissible]);

  return (
    <div className="save-stopped-notice" ref={noticeRef} data-testid="save-stopped-notice">
      <div className="save-stopped-notice-panel" ref={panelRef} tabIndex={-1} role="alertdialog"
          aria-labelledby={titleId} aria-describedby={messageId}>
        <div className="save-stopped-notice-title" id={titleId}>{notice.title}</div>
        <p id={messageId}>{notice.message}</p>
        <p className="save-stopped-notice-code">Code: {reason}</p>
        <div className="save-stopped-notice-buttons">
          {notice.dismissible &&
            <button type="button" className="save-stopped-notice-button" onClick={dismiss}>Close</button>}
          {notice.offerReload &&
            <button type="button" className="save-stopped-notice-button default"
                onClick={() => window.location.reload()}>
              Reload
            </button>}
        </div>
      </div>
    </div>
  );
};
