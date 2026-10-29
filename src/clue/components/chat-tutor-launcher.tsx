import React, { forwardRef, useCallback, useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import { kRightDrawerPanelTabId } from "../../components/right-drawer/right-drawer";

// Floating round "AIdeas" button pinned at the viewport's lower-right. Kept mounted (so the ref
// stays valid for focus restore on close and aria-controls resolves to the live drawer) but
// hidden whenever the right drawer is open, on any tab; it reappears when the drawer closes.
export const ChatTutorLauncher = observer(forwardRef<HTMLButtonElement>(function ChatTutorLauncher(_props, ref) {
  const { ui } = useStores();
  // Feather "message-circle" speech-bubble path.
  const chatIconPath = "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8"
    + "-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48"
    + " 8.48 0 0 1 8 8v.5z";
  return (
    <button
      type="button"
      ref={ref}
      className="chat-tutor-launcher"
      hidden={ui.isRightDrawerOpen}
      aria-label="Open the AIdeas chat with Ada"
      aria-expanded={ui.showChatTutor}
      aria-controls="chat-tutor-sidebar"
      onClick={() => ui.setShowChatTutor(true)}
      data-testid="chat-tutor-launcher"
    >
      <svg
        className="chat-tutor-launcher-icon"
        viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <path d={chatIconPath} />
      </svg>
      <span className="chat-tutor-launcher-label">AIdeas</span>
    </button>
  );
}));

// Returns the handler that closes Ada and restores focus afterwards: to the launcher when the
// drawer closes entirely, or to the panel's tab when a panel keeps the drawer open (the launcher is
// hidden then). Focus is applied after the commit, once the launcher or tab is visible.
export function useCloseChatTutor(launcherRef: React.RefObject<HTMLButtonElement>) {
  const { ui } = useStores();
  const pendingFocusRef = useRef(false);
  const isChatTutorOpen = ui.showChatTutor;

  const close = useCallback(() => {
    pendingFocusRef.current = true;
    ui.setShowChatTutor(false);
  }, [ui]);

  useEffect(() => {
    if (!isChatTutorOpen && pendingFocusRef.current) {
      pendingFocusRef.current = false;
      const target = ui.drawerPanel
        ? document.getElementById(kRightDrawerPanelTabId)
        : launcherRef.current;
      target?.focus();
    }
  }, [isChatTutorOpen, launcherRef, ui]);

  return close;
}
