import { action, computed, makeObservable, observable, reaction } from "mobx";
import { LogEventName } from "../../lib/logger-types";
import { IToolbarEventProps, logToolbarEvent } from "../tiles/log/log-toolbar-event";
import { IStores } from "../stores/stores";
import { ReadAloudQueueItem, isCommentItem } from "./read-aloud-queue-items";

export type ReadAloudState = "idle" | "reading" | "paused";
export type ReadAloudStopReason = "user" | "complete" | "error" | "pane-switch" | "tab-switch";
export type ReadAloudPane = "left" | "right";

const kMaxChunkLength = 200;

export class ReadAloudService {
  @observable state: ReadAloudState = "idle";
  @observable activePane: ReadAloudPane | null = null;
  @observable currentItem: ReadAloudQueueItem | null = null;
  @observable queue: ReadAloudQueueItem[] = [];
  @observable pendingCommentId: string | null = null;

  readonly isSupported: boolean;

  private stores: IStores;
  private toolbarProps: IToolbarEventProps | null = null;
  private queueIndex = 0;
  private allPaneTileIds: Set<string> = new Set();
  private isTargetedOverride = false;
  private currentChunks: string[] = [];
  private currentChunkIndex = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private readGeneration = 0;
  private isSelectingProgrammatically = false;
  /** Timestamp of the last programmatic tile selection by readItem(). Used by
   *  external reactions (chat-thread.tsx) to ignore selection changes caused by
   *  Read Aloud rather than by user clicks. */
  lastProgrammaticSelectionTime = 0;
  private disposers: (() => void)[] = [];
  private synth: SpeechSynthesis | null = null;

  constructor(stores: IStores) {
    makeObservable(this);
    this.stores = stores;
    this.isSupported = typeof window !== "undefined" && "speechSynthesis" in window;
    if (this.isSupported) {
      this.synth = window.speechSynthesis;
      document.addEventListener("keydown", this.handleKeyDown);
    }
  }

  @computed get currentTileId(): string | null {
    return this.currentItem?.associatedTileId ?? null;
  }

  @action setPendingCommentId(commentId: string | null) {
    this.pendingCommentId = commentId;
  }

  dispose() {
    if (this.state !== "idle") {
      this.stop("user");
    }
    if (this.isSupported) {
      document.removeEventListener("keydown", this.handleKeyDown);
    }
  }

  @action start(
    pane: ReadAloudPane,
    items: ReadAloudQueueItem[],
    toolbarProps: IToolbarEventProps,
    allPaneTileIds?: Set<string>,
    commentMode?: "sequential" | "targeted"
  ) {
    if (!this.isSupported) return;

    // Toggle off if already reading on the same pane
    if (this.state !== "idle" && this.activePane === pane) {
      this.stop("user");
      return;
    }

    // Stop reading on the other pane (global singleton)
    if (this.state !== "idle") {
      this.stop("pane-switch");
    }

    this.toolbarProps = toolbarProps;
    this.activePane = pane;
    this.state = "reading";

    this.queue = items;
    this.queueIndex = 0;
    this.allPaneTileIds = allPaneTileIds
      ?? new Set(items.filter(i => i.kind === "tile").map(i => i.associatedTileId!));

    if (this.queue.length === 0) {
      this.stop("complete");
      return;
    }

    // If a comment was clicked before starting, jump directly to it.
    // skipTileSelect prevents readItem from selecting the associated tile so the
    // comment (not the tile) stays as the visual focus.
    let startIndex = 0;
    let skipTileSelect = false;
    if (this.pendingCommentId) {
      const pendingIdx = this.queue.findIndex(
        item => isCommentItem(item) && item.commentId === this.pendingCommentId
      );
      if (pendingIdx >= 0) {
        startIndex = pendingIdx;
        skipTileSelect = true;
      }
    }

    this.setupReactions();

    logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_START, this.toolbarProps, {
      pane: this.activePane,
      documentId: this.toolbarProps.document?.key,
      tileId: this.queue[startIndex]?.associatedTileId ?? null,
      trigger: "user",
      commentMode
    });

    this.queueIndex = startIndex;
    this.readItem(this.queue[startIndex], "auto", skipTileSelect);
  }

  @action stop(reason: ReadAloudStopReason = "user") {
    if (this.state === "idle") return;

    // Invalidate pending callbacks
    ++this.readGeneration;
    this.synth?.cancel();
    this.disposeReactions();

    // Log before clearing state
    if (this.toolbarProps) {
      logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_STOP, this.toolbarProps, {
        pane: this.activePane,
        documentId: this.toolbarProps.document?.key,
        tileId: this.currentTileId,
        reason
      });
    }

    // Do NOT clear selectedTileIds — last tile remains selected.
    // Do NOT clear pendingCommentId — it persists so the next start() can jump
    // to the same comment. It is cleared when the user clicks a tile in the
    // workspace (via the selectedTileIds reaction in chat-thread.tsx).
    this.state = "idle";
    this.activePane = null;
    this.currentItem = null;
    this.toolbarProps = null;
    this.queue = [];
    this.queueIndex = 0;
    this.allPaneTileIds = new Set();
    this.isTargetedOverride = false;
    this.currentChunks = [];
    this.currentChunkIndex = 0;
    this.currentUtterance = null;
  }

  @action pause() {
    if (this.state === "reading") {
      this.synth?.pause();
      this.state = "paused";
    }
  }

  @action resume() {
    if (this.state === "paused") {
      this.state = "reading";
      if (!this.synth?.speaking) {
        // Paused between chunks — speak the next one
        this.speakCurrentChunk();
      } else {
        this.synth?.resume();
      }
    }
  }

  @action replaceQueue(newItems: ReadAloudQueueItem[], allPaneTileIds?: Set<string>) {
    if (this.state === "idle" || this.isTargetedOverride) return;

    // Find current item in new queue by stable key
    const currentItem = this.currentItem;
    let newIndex = -1;

    if (currentItem) {
      if (currentItem.kind === "tile" && currentItem.associatedTileId) {
        newIndex = newItems.findIndex(
          item => item.kind === "tile" && item.associatedTileId === currentItem.associatedTileId
        );
      } else if (isCommentItem(currentItem)) {
        newIndex = newItems.findIndex(
          item => isCommentItem(item) && item.commentId === currentItem.commentId
        );
      } else if (currentItem.kind === "section-header") {
        newIndex = newItems.findIndex(item => item.kind === "section-header");
      }
    }

    this.queue = newItems;
    this.allPaneTileIds = allPaneTileIds ?? this.allPaneTileIds;

    if (newIndex >= 0) {
      // Current item still exists — update index, don't interrupt current speech
      // Invariant: currentItem may reference an item from a previous queue build
      // until the next readItem() call. This is intentional — it matches the
      // currently-speaking content. UI highlighting uses originTileId (stable key),
      // not object identity or speechText.
      this.queueIndex = newIndex;
    } else {
      // Current item was removed — set index so advanceToNextItem (which does
      // queueIndex + 1) picks up the item that now occupies the old position.
      if (newItems.length === 0) {
        this.stop("complete");
      } else {
        this.queueIndex = Math.max(-1, Math.min(this.queueIndex, newItems.length) - 1);
      }
    }
  }

  @action jumpToItem(index: number) {
    if (index < 0 || index >= this.queue.length || this.state === "idle") return;
    ++this.readGeneration;
    this.synth?.cancel();
    this.queueIndex = index;
    // Note: always calls readItem (which speaks), even when paused. This is intentional —
    // jumpToItem is triggered by explicit user clicks (e.g., clicking a comment thread),
    // which signal "play this."
    this.readItem(this.queue[index], "user-click");
  }

  @action private readItem(
    item: ReadAloudQueueItem, trigger: "auto" | "user-click" = "auto", skipTileSelect = false
  ) {
    this.currentItem = item;

    // Select associated tile, or clear selection for items without one.
    // skipTileSelect is true when starting from a pending comment — the user
    // clicked a comment (not a tile), so we preserve their deselected-tile state.
    if (!skipTileSelect) {
      this.isSelectingProgrammatically = true;
      this.lastProgrammaticSelectionTime = Date.now();
      this.stores.ui.setSelectedTileId(item.associatedTileId ?? '');
      this.isSelectingProgrammatically = false;
    }

    this.currentChunks = this.chunkText(item.speechText);
    this.currentChunkIndex = 0;

    // Log transition based on item kind
    this.logItemTransition(item, trigger);

    this.speakCurrentChunk();
  }

  private logItemTransition(item: ReadAloudQueueItem, trigger: "auto" | "user-click") {
    if (!this.toolbarProps) return;

    if (isCommentItem(item)) {
      logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_COMMENT_TRANSITION, this.toolbarProps, {
        pane: this.activePane,
        documentId: this.toolbarProps.document?.key,
        tileId: item.originTileId || "document",
        commentId: item.commentId,
        threadIndex: item.threadIndex,
        commentIndex: item.commentIndex,
        trigger
      });
    } else if (item.kind === "tile") {
      logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_TILE_TRANSITION, this.toolbarProps, {
        pane: this.activePane,
        documentId: this.toolbarProps.document?.key,
        tileId: item.associatedTileId ?? null,
        trigger
      });
    }
    // section-header items are not logged
  }

  private speakCurrentChunk() {
    const gen = ++this.readGeneration;
    const chunk = this.currentChunks[this.currentChunkIndex];
    if (!chunk) {
      this.advanceToNextItem();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    this.currentUtterance = utterance;

    utterance.onend = () => {
      if (gen !== this.readGeneration) return; // stale callback
      this.currentChunkIndex++;
      if (this.state === "paused") return; // let resume() handle it
      if (this.currentChunkIndex < this.currentChunks.length) {
        this.speakCurrentChunk();
      } else {
        this.advanceToNextItem();
      }
    };
    utterance.onerror = () => {
      if (gen !== this.readGeneration) return;
      this.stop("error");
    };

    this.synth?.speak(utterance);
  }

  private advanceToNextItem() {
    this.queueIndex++;
    if (this.queueIndex < this.queue.length) {
      this.readItem(this.queue[this.queueIndex]);
    } else {
      this.stop("complete");
    }
  }

  private chunkText(text: string): string[] {
    const sentencePattern = /[^.!?]+[.!?]+[\s]*/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentencePattern.exec(text)) !== null) {
      sentences.push(match[0]);
      lastIndex = sentencePattern.lastIndex;
    }

    // Capture trailing text without sentence-ending punctuation
    if (lastIndex < text.length) {
      const trailing = text.slice(lastIndex).trim();
      if (trailing) sentences.push(trailing);
    }

    // If no sentences found, treat whole text as one chunk
    if (sentences.length === 0) sentences.push(text);

    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if (current.length + sentence.length > kMaxChunkLength && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks;
  }

  private setupReactions() {
    const { ui, persistentUI } = this.stores;

    this.disposers.push(
      reaction(
        () => [...ui.selectedTileIds],
        (newSelectedIds) => {
          if (this.state === "idle") return;
          if (this.isSelectingProgrammatically) return;

          // Empty selection guard: if currently reading an item without associatedTileId,
          // readItem already handled the setSelectedTileId('') — don't stop.
          if (newSelectedIds.length === 0 || (newSelectedIds.length === 1 && newSelectedIds[0] === "")) {
            if (this.currentItem && !this.currentItem.associatedTileId) {
              return;
            }
          }

          const selectedInThisPane = newSelectedIds.filter(id =>
            this.allPaneTileIds.has(id)
          );
          const selectedInOtherPane = newSelectedIds.length > 0 && selectedInThisPane.length === 0;

          if (selectedInOtherPane) {
            this.stop("pane-switch");
            return;
          }

          if (selectedInThisPane.length === 1 && selectedInThisPane[0] !== this.currentTileId) {
            const selectedId = selectedInThisPane[0];
            ++this.readGeneration;
            this.synth?.cancel();

            if (this.currentItem && this.currentItem.kind !== "tile") {
              // Currently reading non-tile items — workspace tile click means targeted mode
              this.buildTargetedSubQueue(selectedId);
            } else {
              // Same-pane tile switch (existing behavior — jump to tile, continue)
              const tileIndex = this.queue.findIndex(
                item => item.associatedTileId === selectedId && item.kind === "tile"
              );
              if (tileIndex >= 0) {
                this.queueIndex = tileIndex;
                if (this.state === "paused") {
                  this.currentItem = this.queue[tileIndex];
                  this.currentChunks = this.chunkText(this.queue[tileIndex].speechText);
                  this.currentChunkIndex = 0;
                } else {
                  this.readItem(this.queue[tileIndex], "user-click");
                }
              } else {
                // Tile not in queue — stop
                this.stop("user");
              }
            }
          }
        }
      )
    );

    // React to tab/section changes
    if (this.activePane === "right") {
      this.disposers.push(
        reaction(
          () => persistentUI.problemWorkspace.primaryDocumentKey,
          () => { this.stop("tab-switch"); }
        )
      );
    } else {
      // Left pane: stop if the active tab or curriculum section changes
      this.disposers.push(
        reaction(
          () => persistentUI.activeNavTab,
          () => { this.stop("tab-switch"); }
        ),
        reaction(
          () => persistentUI.currentDocumentGroupId,
          () => { this.stop("tab-switch"); }
        )
      );

      // Left pane: stop if the chat panel is closed (immediate, not debounced)
      // Panel opened mid-read is handled by the reactive queue rebuild in ReadAloudButton.
      this.disposers.push(
        reaction(
          () => persistentUI.showChatPanel,
          (isOpen) => {
            if (!isOpen) {
              this.stop("user");
            }
          }
        )
      );
    }
  }

  private buildTargetedSubQueue(tileId: string) {
    const tileItem = this.queue.find(
      item => item.kind === "tile" && item.associatedTileId === tileId
    );
    const commentItems = this.queue.filter(
      item => isCommentItem(item) && item.originTileId === tileId
    );

    const items: ReadAloudQueueItem[] = [];
    if (tileItem) items.push(tileItem);
    items.push(...commentItems);

    if (items.length === 0) {
      this.stop("user");
      return;
    }

    this.isTargetedOverride = true;
    this.queue = items;
    this.queueIndex = 0;
    if (this.state === "paused") {
      this.currentItem = items[0];
      this.currentChunks = this.chunkText(items[0].speechText);
      this.currentChunkIndex = 0;
    } else {
      this.readItem(items[0], "user-click");
    }
  }

  private disposeReactions() {
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (this.state === "idle") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.isEditableTarget(e.target)) return;

    if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      if (this.state === "reading") this.pause();
      else if (this.state === "paused") this.resume();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      this.stop("user");
    }
  };

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    if (tagName === "input" || tagName === "textarea") return true;
    if (target.isContentEditable) return true;
    const inInteractiveContainer = !!target.closest("[role='dialog'],[role='menu'],[role='listbox']");
    return inInteractiveContainer;
  }
}

let instance: ReadAloudService | null = null;

export function getReadAloudService(stores: IStores): ReadAloudService {
  if (!instance) {
    instance = new ReadAloudService(stores);
  }
  return instance;
}

// Must be called in test teardown (afterEach) to avoid leaked keydown listeners.
export function resetReadAloudService() {
  if (instance) {
    instance.stop("user");
    instance.dispose();
  }
  instance = null;
}
