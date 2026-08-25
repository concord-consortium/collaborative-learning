import React, { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react";
import { useStores } from "../../hooks/use-stores";
import { ProblemModelType } from "../../models/curriculum/problem";
import type { IHighlightContentModel } from "../../models/highlights/highlight-content-model";
import { uniqueId } from "../../utilities/js-utils";
import { urlParams } from "../../utilities/url-params";
import { Chat, highlightKey } from "./chat";
import { useChat } from "./use-chat";
import { ChatTransport } from "./transport";
import { conversationDocId } from "./conversation-key";
import { DebugTransport } from "./debug-transport";
import { FirestoreTransport } from "./firestore-transport";
import { buildLeftContext, problemSectionsLoaded } from "./left-context";
import { normalizeTutorPrompts, tutorPromptsKey } from "./tutor-prompts";
import { useRightDirty } from "./use-right-dirty";
import { useTutorDrawerTrap } from "./use-tutor-drawer-trap";
import { CHAT_TUTOR_DEFAULT_INTRO } from "../../../shared/chat-tutor-default-intro";

import "./chat-sidebar.scss";

interface IProps {
  documentKey: string;
  documentTitle: string;
  problemPath: string;
  problem: ProblemModelType;
  // The workspace document's content model; undefined until the document loads. Typed as the
  // narrow highlight slice rather than the whole content model: this component drives highlights
  // and hands the node to the summarizer, and depending on more than that would hide which parts
  // of the document it actually needs.
  content: IHighlightContentModel | undefined;
  onClose: () => void;
}

// Right-edge overlay drawer for the AI chat tutor. Mounted only while open (the
// app-header launcher owns the open/close state); mounting resets the transport, so
// switching documents or problems while open swaps the conversation.
//
// An observer because the pinned highlight button reflects `content.pinnedHighlightSource`,
// which can be taken over by another highlight source (a variable chip, say) while this
// sidebar stays open.
export const ChatTutorSidebar: React.FC<IProps> = observer((props) => {
  const { documentKey, documentTitle, problemPath, problem, content, onClose } = props;
  const { appConfig, db, user } = useStores();
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useTutorDrawerTrap({ containerRef, bodyRef, onEscape: onClose });

  const getRightSummary = useRightDirty(documentKey, content);

  // chatDebug selects the backend-free debug transport; otherwise the live Firestore
  // path. Rebuilding on documentKey/problemPath change is the hard conversation swap;
  // the unit's authored prompt overrides are mixed into the conversation id so a
  // prompt edit (config can only change with a reload) also starts a fresh conversation.
  const transport: ChatTransport = useMemo(() => {
    const getLeftContext = () => problemSectionsLoaded(problem) ? buildLeftContext(problem) : undefined;
    const tutorPrompts = normalizeTutorPrompts(appConfig.chatTutorPrompts);
    if (urlParams.chatDebug) {
      return new DebugTransport({ getLeftContext, getRightSummary, tutorPrompts });
    }
    const promptsKey = tutorPrompts && tutorPromptsKey(tutorPrompts);
    return new FirestoreTransport({
      firestore: db.firestore,
      conversationId: conversationDocId(user.id, documentKey, user.network, problemPath, promptsKey),
      uid: user.id,
      contextId: user.classHash,
      problemPath,
      getLeftContext,
      getRightSummary,
      tutorPrompts,
    });
  }, [documentKey, problemPath, problem, getRightSummary, appConfig, db, user]);

  // The drawer header makes the conversation scope legible: this conversation is bound
  // to one workspace document within one problem, and swaps when either changes.
  const header = `${documentTitle} · ${problemPath}`;
  const chat = useChat({ transport, header });

  // Display-only persona intro (never part of the AI context). An unset value uses the built-in
  // default; an authored empty string suppresses the intro entirely (?? keeps "" distinct from unset).
  const introText = appConfig.chatTutorIntro ?? CHAT_TUTOR_DEFAULT_INTRO;

  // Identifies this sidebar instance as a highlight source. Several sources share one document, and
  // two of them can cite the same object, so ownership is decided by token rather than by reference.
  // useRef rather than useMemo: React is allowed to discard a memoized value and recompute it, which
  // here would mint a new token mid-life and strand this sidebar's own pinned highlight.
  const highlightSource = useRef(`chat-highlight-${uniqueId()}`).current;

  // Which of this sidebar's buttons is pinned. React state rather than a ref: every button here
  // shares one source token, so re-pinning within this sidebar can leave
  // content.pinnedHighlightSource holding the value it already had, giving MobX nothing to react to
  // and leaving the previously pressed button with stale `.active`/`aria-pressed`. A state update
  // re-renders either way.
  //
  // handleHighlightToggle also drops this sidebar's pin before moving it, which changes the source
  // to undefined and back and forces the same re-render — so switching this to a ref fails no test.
  // Keep the state regardless: that clear is there to stop two buttons citing one object from
  // cancelling each other, and nothing binds it to keeping the pressed state fresh.
  const [pinnedKey, setPinnedKey] = useState<string | undefined>(undefined);

  // Deferring to the model rather than trusting pinnedKey alone is what makes another source taking
  // the pin — a variable chip, say — un-press this sidebar's button.
  const activeHighlightKey = content?.pinnedHighlightSource === highlightSource
    ? pinnedKey : undefined;

  const findHighlight = (turnId: string, index: number) =>
    chat.turns.find(t => t.id === turnId)?.highlights?.[index];

  const handleHighlightHover = (turnId: string, index: number, hovering: boolean) => {
    if (!content) return;
    if (!hovering) {
      content.clearHoveredHighlightRefIfOwn(highlightSource);
      return;
    }
    const highlight = findHighlight(turnId, index);
    if (!highlight) return;
    content.setHoveredHighlightRef(
      { kind: "object", tileId: highlight.tileId, objectId: highlight.objectId },
      highlightSource);
  };

  const handleHighlightToggle = (turnId: string, index: number) => {
    const highlight = content && findHighlight(turnId, index);
    if (!highlight) return;
    const key = highlightKey(turnId, index);
    // Two buttons can cite the same object — the same node named again in a later turn, say — and
    // every button here shares this sidebar's one token. togglePinnedHighlightRef releases when the
    // reference and the source both match, so clicking the second of them would release the pin
    // rather than move it, leaving no button pressed and no ring. Dropping our own pin first makes
    // the toggle below always pin; re-clicking the pressed button is then the only way to release.
    if (activeHighlightKey && activeHighlightKey !== key) {
      content.clearPinnedHighlightRefIfOwn(highlightSource);
    }
    content.togglePinnedHighlightRef(
      { kind: "object", tileId: highlight.tileId, objectId: highlight.objectId },
      highlightSource);
    setPinnedKey(content.pinnedHighlightSource === highlightSource ? key : undefined);
  };

  // React does not fire onMouseLeave for an element that unmounts under the cursor, and a pinned
  // highlight can only be dismissed by clicking its button — so a sidebar that closes while pinned
  // would strand a ring on the tile for the rest of the session. The same release also has to run
  // when documentKey/problemPath change without an unmount: that swaps the conversation (see the
  // component comment above), so a highlight owned by the old conversation must not survive into it.
  useEffect(() => {
    return () => {
      content?.clearHoveredHighlightRefIfOwn(highlightSource);
      content?.clearPinnedHighlightRefIfOwn(highlightSource);
    };
  }, [content, highlightSource, documentKey, problemPath]);

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
        <Chat chat={chat} onClose={onClose} closeLabel="Close tutor chat" transcriptTitle={header}
              introText={introText}
              onHighlightHover={handleHighlightHover}
              onHighlightToggle={handleHighlightToggle}
              activeHighlightKey={activeHighlightKey}
              enableHighlights={!!appConfig.chatTutorHighlights} />
      </div>
    </div>
  );
});
