import React, { useMemo, useRef } from "react";
import { IAnyStateTreeNode } from "mobx-state-tree";
import { ProblemModelType } from "../../models/curriculum/problem";
import { Chat } from "./chat";
import { useChat } from "./use-chat";
import { ChatTransport } from "./transport";
import { DebugTransport } from "./debug-transport";
import { buildLeftContext, problemSectionsLoaded } from "./left-context";
import { useRightDirty } from "./use-right-dirty";
import { useTutorDrawerTrap } from "./use-tutor-drawer-trap";

import "./chat-sidebar.scss";

interface IProps {
  documentKey: string;
  documentTitle: string;
  problemPath: string;
  problem: ProblemModelType;
  // the workspace document's content node; undefined until the document loads
  content: IAnyStateTreeNode | undefined;
  onClose: () => void;
}

// Right-edge overlay drawer for the AI chat tutor. Mounted only while open (the
// app-header launcher owns the open/close state); mounting resets the transport, so
// switching documents or problems while open swaps the conversation.
export const ChatTutorSidebar: React.FC<IProps> = (props) => {
  const { documentKey, documentTitle, problemPath, problem, content, onClose } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useTutorDrawerTrap({ containerRef, bodyRef, onEscape: onClose });

  const getRightSummary = useRightDirty(documentKey, content);

  const transport: ChatTransport = useMemo(() => {
    return new DebugTransport({
      getLeftContext: () => problemSectionsLoaded(problem) ? buildLeftContext(problem) : undefined,
      getRightSummary,
    });
    // documentKey + problemPath are intentional re-key deps: a new document or problem
    // is a hard conversation swap even though the transport reads them only via closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey, problemPath, problem, getRightSummary]);

  // The drawer header makes the conversation scope legible: this conversation is bound
  // to one workspace document within one problem, and swaps when either changes.
  const header = `${documentTitle} · ${problemPath}`;
  const chat = useChat({ transport, header });

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      id="chat-tutor-sidebar"
      className="chat-tutor-sidebar"
      role="complementary"
      aria-label={`Tutor chat: ${header}`}
      data-testid="chat-tutor-sidebar"
    >
      <div ref={bodyRef} className="chat-tutor-sidebar-body">
        <Chat chat={chat} onClose={onClose} closeLabel="Close tutor chat" transcriptTitle={header} />
      </div>
    </div>
  );
};
