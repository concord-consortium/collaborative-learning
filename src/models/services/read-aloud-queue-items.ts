import { getTileComponentInfo } from "../tiles/tile-component-info";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { kTextTileType, TextContentModelType } from "../tiles/text/text-content";
import { DocumentContentModelType } from "../document/document-content";
import { CommentWithId, DocumentCommentsManager } from "../document/document-comments-manager";
import {
  ChatCommentThread, makeChatThreads, sortCommentsInDocumentOrder
} from "../../components/chat/chat-comment-thread";
import type { ReadAloudPane } from "./read-aloud-service";
import type { ITileModel } from "../tiles/tile-model";

// --- Item type interfaces ---

export interface ReadAloudQueueItem {
  kind: string;
  speechText: string;
  /** The tile to select in the UI when this item is read (if any). */
  associatedTileId?: string;
}

export interface TileReadAloudItem extends ReadAloudQueueItem {
  kind: "tile";
  associatedTileId: string;  // required, not optional
}

export interface SectionHeaderReadAloudItem extends ReadAloudQueueItem {
  kind: "section-header";
}

export interface CommentReadAloudItem extends ReadAloudQueueItem {
  kind: "comment";
  commentId: string;            // Firestore document ID — stable key for replaceQueue matching
  // associatedTileId inherited as optional — set for tile-level threads, omitted for document-level and deleted-tile
  originTileId: string | null;  // stable thread identity: thread.tileId (even for deleted tiles), null for doc-level
  threadIndex: number;          // position of the parent thread at build time (telemetry)
  commentIndex: number;         // position within thread (telemetry)
}

// --- Type guards ---

export function isTileItem(item: ReadAloudQueueItem): item is TileReadAloudItem {
  return item.kind === "tile";
}

export function isCommentItem(
  item: ReadAloudQueueItem
): item is CommentReadAloudItem {
  return item.kind === "comment";
}

export function isSectionHeaderItem(
  item: ReadAloudQueueItem
): item is SectionHeaderReadAloudItem {
  return item.kind === "section-header";
}

// --- Speech text composition ---

function getTileTypeName(type: string): string {
  return getTileContentInfo(type)?.displayName || type;
}

export function buildTileSpeechText(tile: ITileModel): string {
  const tileType = tile.content.type;
  const title = getTileComponentInfo(tileType)?.hiddenTitle ? "" : tile.computedTitle;
  const typeName = getTileTypeName(tileType);

  let textContent = "";
  if (tileType === kTextTileType) {
    textContent = (tile.content as TextContentModelType).asPlainText();
  }

  if (title && textContent) return `${title}. ${textContent}`;
  if (title && !textContent) return `${typeName} tile: ${title}`;
  if (!title && textContent) return textContent;
  return `${typeName} tile`;
}

/**
 * Build the spoken header for a comment thread (e.g. "Coordinate Grid tile: My Shape").
 * Returns empty string if the thread has no meaningful header.
 */
export function buildThreadHeaderText(thread: ChatCommentThread): string {
  if (thread.isDeletedTile) {
    return "Deleted Tile";
  } else if (thread.tileId && thread.tileType) {
    const typeName = getTileTypeName(thread.tileType);
    return thread.title ? `${typeName} tile: ${thread.title}` : `${typeName} tile`;
  } else if (thread.title) {
    return thread.title;
  }
  return "";
}

// --- Comment item builder helper ---

/**
 * Push per-comment queue items for a thread. The first non-empty comment gets the
 * thread header prepended to its speechText; subsequent comments get just "{name} said: {content}".
 */
function pushCommentItems(
  items: ReadAloudQueueItem[],
  thread: ChatCommentThread,
  threadIndex: number
): void {
  const header = buildThreadHeaderText(thread);
  const associatedTileId = thread.isDeletedTile || !thread.tileId ? undefined : thread.tileId;
  const originTileId = thread.tileId;

  let commentIndex = 0;
  for (const comment of thread.comments) {
    const content = comment.content?.trim();
    if (!content) continue; // skip empty/whitespace-only

    const attribution = `${comment.name} said: ${content}`;
    // First spoken comment in the thread gets the header prepended
    const speechText = commentIndex === 0 && header
      ? `${header}. ${attribution}`
      : attribution;

    items.push({
      kind: "comment",
      speechText,
      commentId: comment.id,
      associatedTileId,
      originTileId,
      threadIndex,
      commentIndex
    } as CommentReadAloudItem);
    commentIndex++;
  }
}

// --- Builder ---

export interface BuildReadAloudQueueOptions {
  commentsManager?: DocumentCommentsManager;
  comments?: CommentWithId[];  // Direct comments; used when commentsManager is unavailable (e.g., curriculum sections)
  showChatPanel?: boolean;
  isDocumentsView?: boolean;
  pane?: ReadAloudPane;
  docTitle?: string;
  /** When true, read only comments (skip tiles). Set when the comments panel is focused. */
  commentsOnly?: boolean;
}

export interface BuildReadAloudQueueResult {
  items: ReadAloudQueueItem[];
  allPaneTileIds: Set<string>;
  /** Comment-reading mode. "sequential" = comments follow full tile read;
   *  "targeted" = comments scoped to selected tile(s). */
  commentMode?: "sequential" | "targeted";
}

export function buildReadAloudQueue(
  content: DocumentContentModelType,
  selectedTileIds: string[],
  options?: BuildReadAloudQueueOptions
): BuildReadAloudQueueResult {
  const allTileIds = content.getAllTileIds(false);

  // Determine which tiles to read
  let tileIds: string[];
  if (selectedTileIds.length > 0) {
    const selectedSet = new Set(selectedTileIds);
    const selectedInContent = allTileIds.filter(id => selectedSet.has(id));
    tileIds = selectedInContent.length > 0 ? selectedInContent : allTileIds;
  } else {
    tileIds = allTileIds;
  }

  // Build tile items (skip when commentsOnly — comments panel is focused)
  const items: ReadAloudQueueItem[] = [];
  const { commentsManager, comments: directComments, showChatPanel, isDocumentsView, pane, docTitle,
    commentsOnly } = options ?? {};
  if (!commentsOnly) {
    for (const id of tileIds) {
      const tile = content.getTile(id);
      if (!tile) continue;
      items.push({
        kind: "tile",
        speechText: buildTileSpeechText(tile),
        associatedTileId: id
      } as TileReadAloudItem);
    }
  }

  // Targeted mode: tile was selected, so reading queue is scoped to that tile
  const isTargetedMode = !commentsOnly && selectedTileIds.length > 0
    && tileIds.length < allTileIds.length;
  if (pane === "left" && showChatPanel && !isDocumentsView) {
    const comments = directComments ?? commentsManager?.comments;
    if (comments && comments.length > 0) {
      const sorted = sortCommentsInDocumentOrder(comments, content);
      const threads = makeChatThreads(sorted, content, docTitle);

      if (isTargetedMode) {
        // When multiple tiles are selected, comments are only read for the first
        // selected-in-content tile. Multi-tile selection is rare in CLUE.
        const targetThread = threads.find(t => t.tileId === tileIds[0]);
        if (targetThread) {
          const threadIndex = threads.indexOf(targetThread);
          pushCommentItems(items, targetThread, threadIndex);
        }
      } else if (threads.length > 0) {
        // Collect comment items first, then prepend the section header only if
        // at least one non-empty comment was emitted. This avoids announcing
        // "Comments" when all comments in every thread are empty/whitespace.
        const commentItems: ReadAloudQueueItem[] = [];
        for (let i = 0; i < threads.length; i++) {
          pushCommentItems(commentItems, threads[i], i);
        }
        if (commentItems.length > 0) {
          items.push({
            kind: "section-header",
            speechText: "Comments"
          } as SectionHeaderReadAloudItem);
          items.push(...commentItems);
        }
      }
    }
  }

  // Determine commentMode for START event logging
  const hasComments = items.some(item => item.kind === "comment");
  const commentMode = hasComments
    ? (isTargetedMode ? "targeted" : "sequential")
    : undefined;

  return { items, allPaneTileIds: new Set(allTileIds), commentMode };
}
