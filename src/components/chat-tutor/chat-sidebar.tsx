import React, { useMemo, useRef } from "react";
import { IAnyStateTreeNode } from "mobx-state-tree";
import { useStores } from "../../hooks/use-stores";
import { ProblemModelType } from "../../models/curriculum/problem";
import { urlParams } from "../../utilities/url-params";
import { Chat } from "./chat";
import { useChat } from "./use-chat";
import { ChatTransport } from "./transport";
import { conversationDocId } from "./conversation-key";
import { DebugTransport } from "./debug-transport";
import { FirestoreTransport } from "./firestore-transport";
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
  const { db, user } = useStores();
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useTutorDrawerTrap({ containerRef, bodyRef, onEscape: onClose });

  const getRightSummary = useRightDirty(documentKey, content);

  // chatDebug selects the backend-free debug transport; otherwise the live Firestore
  // path. Rebuilding on documentKey/problemPath change is the hard conversation swap.
  const transport: ChatTransport = useMemo(() => {
    const getLeftContext = () => problemSectionsLoaded(problem) ? buildLeftContext(problem) : undefined;
    if (urlParams.chatDebug) {
      return new DebugTransport({ getLeftContext, getRightSummary });
    }
    return new FirestoreTransport({
      firestore: db.firestore,
      conversationId: conversationDocId(user.id, documentKey, user.network, problemPath),
      uid: user.id,
      contextId: user.classHash,
      problemPath,
      getLeftContext,
      getRightSummary,
    });
  }, [documentKey, problemPath, problem, getRightSummary, db, user]);

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
