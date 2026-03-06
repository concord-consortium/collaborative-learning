import classNames from "classnames";
import React, { useEffect, useMemo, useRef } from "react";
import { observer } from "mobx-react";
import { comparer, reaction } from "mobx";
import { IButtonProps } from "../toolbar-button";
import { DocumentModelType } from "../../models/document/document";
import { SectionModelType } from "../../models/curriculum/section";
import { getReadAloudService } from "../../models/services/read-aloud-service";
import { buildReadAloudQueue } from "../../models/services/read-aloud-queue-items";
import { getDocumentDisplayTitle } from "../../models/document/document-utils";
import { useAppConfig, useDocumentFromStore, useStores } from "../../hooks/use-stores";
import {
  useDocumentComments, useDocumentCommentsAtSimplifiedPath
} from "../../hooks/document-comment-hooks";

interface IProps extends IButtonProps {
  pane: "left" | "right";
  document?: DocumentModelType;
  section?: SectionModelType;
}

export const ReadAloudButton: React.FC<IProps> = observer(function ReadAloudButton({
  toolButton, isDisabled: _isDisabled, pane, document: doc, section
}) {
  const stores = useStores();
  const appConfig = useAppConfig();
  const service = getReadAloudService(stores);
  const originalSelectedIdsRef = useRef<string[]>([]);

  // On the left pane the toolbar receives a section (not a document), so doc is undefined.
  // Look up the focused document from the stores to access its commentsManager for comments.
  const focusDocKey = pane === "left" && !doc ? stores.persistentUI.focusDocument : undefined;
  const focusDoc = useDocumentFromStore(focusDocKey);

  // Load comments directly via Firestore hooks (react-query caches shared with ChatPanel).
  // This ensures comments are available even for curriculum sections where commentsManager
  // doesn't exist. Only query on the left pane when the chat panel is relevant.
  const commentDocKey = pane === "left" ? (focusDocKey ?? doc?.key) : undefined;
  const { data: prefixedComments } = useDocumentComments(commentDocKey);
  const { data: simplePathComments } = useDocumentCommentsAtSimplifiedPath(commentDocKey);
  const hookComments = useMemo(() => {
    if (!prefixedComments?.length && !simplePathComments?.length) return undefined;
    return [...prefixedComments || [], ...simplePathComments || []]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [prefixedComments, simplePathComments]);

  // Compute variables needed by useEffect — must be before any early returns
  const content = doc?.content ?? section?.content;
  const commentsManager = doc?.commentsManager ?? focusDoc?.commentsManager;
  const isActive = service.isReadingPane(pane);
  const titleDoc = doc ?? focusDoc;
  const docTitle = titleDoc ? getDocumentDisplayTitle(stores.unit, titleDoc, appConfig) || undefined : undefined;

  // Reactive queue sync: rebuild queue when document/comments/panel state changes during reading.
  // Two triggers: (1) MobX reaction detects MobX-observable changes (tile list, commentsManager,
  // panel state), debounced at 800ms. (2) When hookComments changes (React Query state, not MobX-
  // observable), the useEffect re-runs and does an immediate rebuild below.
  useEffect(() => {
    if (!isActive || !content) return;

    const rebuildAndReplace = () => {
      const selectedIds = originalSelectedIdsRef.current;
      const onlyComments = pane === "left" && stores.persistentUI.showChatPanel
        && !stores.persistentUI.isDocumentsView && selectedIds.length === 0;
      const { items, allPaneTileIds } = buildReadAloudQueue(content, selectedIds, {
        commentsManager: commentsManager ?? undefined,
        comments: hookComments,
        showChatPanel: stores.persistentUI.showChatPanel,
        isDocumentsView: stores.persistentUI.isDocumentsView,
        pane,
        docTitle,
        commentsOnly: onlyComments
      });
      service.replaceQueue(items, allPaneTileIds);
    };

    // Immediate rebuild when this effect re-runs due to a dep change (e.g. hookComments).
    // Safe to call unconditionally: replaceQueue reconciles position by stable key and
    // doesn't interrupt current speech. On the initial run (reading just started), the
    // queue is identical to what start() received, so replaceQueue is effectively a no-op.
    rebuildAndReplace();

    const disposer = reaction(
      // Data function — observe changes to document structure and comments
      () => ({
        tileIds: content.getAllTileIds(false),
        commentCount: commentsManager?.comments?.length ?? 0,
        showChatPanel: stores.persistentUI.showChatPanel,
        isDocumentsView: stores.persistentUI.isDocumentsView
      }),
      // Effect function — rebuild queue and replace
      rebuildAndReplace,
      { delay: 800, equals: comparer.structural }
    );

    return () => disposer();
  }, [isActive, content, commentsManager, hookComments, pane, doc, focusDoc, docTitle,
      stores.persistentUI, service, stores.unit, appConfig]);

  // Hide entirely if speech synthesis not supported
  if (!service.isSupported) return null;

  const hasTiles = (content?.getAllTileIds(false)?.length ?? 0) > 0;
  // On the left pane with the chat panel open (Comments View), comments may be readable
  // even if commentsManager isn't populated (e.g., curriculum sections load comments via
  // Firestore hooks, not through commentsManager). Enable the button optimistically —
  // if the queue turns out empty, the service stops immediately with "complete".
  const mayHaveComments = pane === "left"
    && stores.persistentUI.showChatPanel && !stores.persistentUI.isDocumentsView;
  const hasReadableContent = hasTiles || mayHaveComments;
  const isDisabled = (_isDisabled || !hasReadableContent) && !isActive;
  const title = `${toolButton.title}: ${isActive ? "On" : "Off"}`;
  const tileEltClass = toolButton.id.toLowerCase();
  const className = classNames("tool", tileEltClass,
    { active: isActive }, isDisabled ? "disabled" : "enabled");

  const handleClick = () => {
    if (isDisabled) return;
    if (isActive) {
      service.stop("user");
    } else if (content) {
      const selectedIds = Array.from(stores.ui.selectedTileIds);
      originalSelectedIdsRef.current = selectedIds;
      // When the comments panel is focused (open, no tiles selected), read only comments.
      const commentsOnly = pane === "left" && stores.persistentUI.showChatPanel
        && !stores.persistentUI.isDocumentsView && selectedIds.length === 0;
      const { items, allPaneTileIds, commentMode } = buildReadAloudQueue(content, selectedIds, {
        commentsManager: commentsManager ?? undefined,
        comments: hookComments,
        showChatPanel: stores.persistentUI.showChatPanel,
        isDocumentsView: stores.persistentUI.isDocumentsView,
        pane,
        docTitle,
        commentsOnly
      });
      service.start(pane, items, { document: doc, section }, allPaneTileIds, commentMode);
    }
  };

  return (
    <button
      aria-disabled={isDisabled || undefined}
      aria-label={title}
      aria-pressed={isActive}
      className={className}
      data-testid={`tool-${tileEltClass}`}
      title={title}
      type="button"
      onClick={handleClick}
    >
      {toolButton.Icon && <toolButton.Icon />}
    </button>
  );
});
