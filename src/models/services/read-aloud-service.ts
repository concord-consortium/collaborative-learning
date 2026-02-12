import { action, makeObservable, observable, reaction } from "mobx";
import { LogEventName } from "../../lib/logger-types";
import { IToolbarEventProps, logToolbarEvent } from "../tiles/log/log-toolbar-event";
import { DocumentContentModelType } from "../document/document-content";
// TODO: enable when hiddenTitle check is enabled in prepareTile
// import { getTileComponentInfo } from "../tiles/tile-component-info";
import { getTileContentInfo } from "../tiles/tile-content-info";
import { kTextTileType, TextContentModelType } from "../tiles/text/text-content";
import { IStores } from "../stores/stores";

export type ReadAloudState = "idle" | "reading" | "paused";
export type ReadAloudStopReason = "user" | "complete" | "error" | "pane-switch" | "tab-switch";
export type ReadAloudPane = "left" | "right";

const kMaxChunkLength = 200;

function getTileTypeName(type: string): string {
  return getTileContentInfo(type)?.displayName || type;
}

export class ReadAloudService {
  @observable state: ReadAloudState = "idle";
  @observable activePane: ReadAloudPane | null = null;
  @observable currentTileId: string | null = null;

  readonly isSupported: boolean;

  private stores: IStores;
  private documentContent: DocumentContentModelType | null = null;
  private toolbarProps: IToolbarEventProps | null = null;
  private tileQueue: string[] = [];
  private currentChunks: string[] = [];
  private currentChunkIndex = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private readGeneration = 0;
  private isSelectingProgrammatically = false;
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
    content: DocumentContentModelType,
    selectedTileIds: string[],
    toolbarProps: IToolbarEventProps
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

    this.documentContent = content;
    this.toolbarProps = toolbarProps;
    this.activePane = pane;
    this.state = "reading";

    const allTileIds = content.getAllTileIds(false);
    if (selectedTileIds.length > 0) {
      const selectedSet = new Set(selectedTileIds);
      const selectedInContent = allTileIds.filter(id => selectedSet.has(id));
      // Fall back to all tiles if no selected tiles belong to this pane's content
      this.tileQueue = selectedInContent.length > 0 ? selectedInContent : allTileIds;
    } else {
      this.tileQueue = allTileIds;
    }

    if (this.tileQueue.length === 0) {
      this.stop("complete");
      return;
    }

    this.setupReactions();

    logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_START, this.toolbarProps, {
      pane: this.activePane,
      documentId: this.toolbarProps.document?.key,
      tileId: this.tileQueue[0],
      trigger: "user"
    });

    this.readTile(this.tileQueue[0]);
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

    // Do NOT clear selectedTileIds — last tile remains selected
    this.state = "idle";
    this.activePane = null;
    this.currentTileId = null;
    this.documentContent = null;
    this.toolbarProps = null;
    this.tileQueue = [];
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

  @action private prepareTile(tileId: string): boolean {
    if (!this.documentContent) return false;

    const tile = this.documentContent.getTile(tileId);
    if (!tile) {
      // Tile was deleted mid-read
      this.advanceToNextTile();
      return false;
    }

    this.currentTileId = tileId;

    const tileType = tile.content.type;
    // TODO: enable hiddenTitle check to suppress non-visible tile titles from speech
    // const title = getTileComponentInfo(tileType)?.hiddenTitle ? "" : tile.computedTitle;
    const title = tile.computedTitle;
    const typeName = getTileTypeName(tileType);

    let textContent = "";
    if (tileType === kTextTileType) {
      textContent = (tile.content as TextContentModelType).asPlainText();
    }

    // Compose speech text
    let speechText: string;
    if (title && textContent) {
      speechText = `${title}. ${textContent}`;
    } else if (title && !textContent) {
      speechText = `${typeName} tile: ${title}`;
    } else if (!title && textContent) {
      speechText = textContent;
    } else {
      speechText = `${typeName} tile`;
    }

    this.currentChunks = this.chunkText(speechText);
    this.currentChunkIndex = 0;
    return true;
  }

  private readTile(tileId: string) {
    if (!this.prepareTile(tileId)) return;

    // Select the tile in UI
    this.isSelectingProgrammatically = true;
    this.stores.ui.setSelectedTileId(tileId);
    this.isSelectingProgrammatically = false;

    // Log tile transition
    if (this.toolbarProps) {
      logToolbarEvent(LogEventName.TOOLBAR_READ_ALOUD_TILE_TRANSITION, this.toolbarProps, {
        pane: this.activePane,
        documentId: this.toolbarProps.document?.key,
        tileId
      });
    }

    this.speakCurrentChunk();
  }

  private speakCurrentChunk() {
    const gen = ++this.readGeneration;
    const chunk = this.currentChunks[this.currentChunkIndex];
    if (!chunk) {
      this.advanceToNextTile();
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
        this.advanceToNextTile();
      }
    };
    utterance.onerror = () => {
      if (gen !== this.readGeneration) return;
      this.stop("error");
    };

    this.synth?.speak(utterance);
  }

  // Note: indexOf() is O(n) per call, but tile queues are small (< 20 tiles)
  // so tracking a separate index isn't worth the added state complexity.
  private advanceToNextTile() {
    if (!this.currentTileId) {
      this.stop("complete");
      return;
    }

    const index = this.tileQueue.indexOf(this.currentTileId);
    if (index === -1) {
      this.stop("complete");
      return;
    }

    if (index + 1 < this.tileQueue.length) {
      this.readTile(this.tileQueue[index + 1]);
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

          const selectedInThisPane = newSelectedIds.filter(id => this.documentContent?.getTile(id));
          const selectedInOtherPane = newSelectedIds.length > 0 && selectedInThisPane.length === 0;

          if (selectedInOtherPane) {
            this.stop("pane-switch");
            return;
          }

          if (selectedInThisPane.length === 1 && selectedInThisPane[0] !== this.currentTileId) {
            ++this.readGeneration;
            this.synth?.cancel();
            if (this.state === "paused") {
              this.prepareTile(selectedInThisPane[0]);
            } else {
              this.readTile(selectedInThisPane[0]);
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
