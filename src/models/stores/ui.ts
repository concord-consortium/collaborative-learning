import { SnapshotIn, types } from "mobx-state-tree";
import { debounce } from "lodash";
import { UIDialogTypeEnum } from "./ui-types";
import { WorkspaceModel } from "./workspace";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { ITileModel } from "../tiles/tile-model";

type BooleanDialogResolver = (value: boolean | PromiseLike<boolean>) => void;
type StringDialogResolver = (value: string | PromiseLike<string>) => void;
let dialogResolver: BooleanDialogResolver | StringDialogResolver | undefined;


// Information needed to scroll to a tile (for example, when a comment about a tile is selected)
const ScrollToModel = types
  .model("ScrollTo", {
    tileId: types.string,
    docId: types.string // key for user doc, path for problem doc
  });

export const UIDialogModel = types
  .model("UIDialog", {
    type: UIDialogTypeEnum,
    text: types.string,
    title: types.maybe(types.string),
    className: "",
    defaultValue: types.maybe(types.string),
    copyFromDocumentKey: types.maybe(types.string),
    rows: types.maybe(types.number)
  })
  .volatile(self => ({
    promptValue: self.defaultValue,
    copyToDocumentKey: self.defaultValue
  }))
  .actions(self => ({
    setPromptValue(value: string) {
      self.promptValue = value;
    },
    setCopyToDocumentKey(value: string) {
      self.copyToDocumentKey = value;
    }
  }));
type UIDialogModelSnapshot = SnapshotIn<typeof UIDialogModel>;
type UIDialogModelSnapshotWithoutType = Omit<UIDialogModelSnapshot, "type">;

export const UIModel = types
  .model("UI", {
    annotationMode: types.maybe(types.string),
    error: types.maybeNull(types.string),
    expandedSortWorkSections: types.optional(types.array(types.string), []),
    highlightedSortWorkDocument: types.maybe(types.string),
    selectedTileIds: types.array(types.string),
    selectedCommentId: types.maybe(types.string),
    scrollTo: types.maybe(ScrollToModel),
    showDemo: false,
    showDemoCreator: false,
    dialog: types.maybe(UIDialogModel),
    learningLogWorkspace: WorkspaceModel,
    dragId: types.maybe(types.string) // The id of the object being dragged. Used with dnd-kit dragging.
  })
  .volatile(self => ({
    defaultLeftNavExpanded: false,
    standalone: false,
    errorContent: undefined as React.FC<any> | undefined,
  }))
  .views((self) => ({
    isSelectedTile(tile: ITileModel) {
      return self.selectedTileIds.indexOf(tile.id) !== -1;
    }
  }))
  .actions((self) => {
    const alert = (textOrOpts: string | UIDialogModelSnapshotWithoutType, title?: string) => {
      self.dialog = UIDialogModel.create(typeof textOrOpts === "string"
                                          ? { type: "alert", text: textOrOpts, title }
                                          : { type: "alert", ...textOrOpts });
      dialogResolver = undefined;
    };

    const confirm = (textOrOpts: string | UIDialogModelSnapshotWithoutType, title?: string) => {
      self.dialog = UIDialogModel.create(typeof textOrOpts === "string"
                                          ? { type: "confirm", text: textOrOpts, title }
                                          : { type: "confirm", ...textOrOpts });
      return new Promise<boolean>((resolve, reject) => {
        dialogResolver = resolve;
      });
    };

    const prompt = (textOrOpts: string | UIDialogModelSnapshotWithoutType,
                    defaultValue = "", title?: string, rows?: number) => {
      self.dialog = UIDialogModel.create(typeof textOrOpts === "string"
                                          ? { type: "prompt", text: textOrOpts, defaultValue, title, rows }
                                          : { type: "prompt", ...textOrOpts });
      return new Promise<string>((resolve, reject) => {
        dialogResolver = resolve;
      });
    };

    const getCopyToDocumentKey = (copyFromDocumentKey: string) => {
      self.dialog = UIDialogModel.create({
        type: "getCopyToDocument",
        title: "Copy to Document",
        text: "Choose a document to copy the selected tiles to:",
        copyFromDocumentKey,
      });
      return new Promise<string>((resolve, reject) => {
        dialogResolver = resolve;
      });
    };

    const resolveDialog = (value: string | boolean) => {
      if (dialogResolver) {
        dialogResolver(value as any);
      }
      closeDialog();
    };

    const closeDialog = () => {
      self.dialog = undefined;
      dialogResolver = undefined;
    };

    const setOrAppendTileIdToSelection = (tileId?: string, options?: {append: boolean, dragging?: boolean}) => {
      if (tileId) {
        const tileIdIndex = self.selectedTileIds.indexOf(tileId);
        const isCurrentlySelected = tileIdIndex >= 0;
        const isExtendingSelection = options?.append;
        if (isExtendingSelection) {
          if (isCurrentlySelected) {
            // clicking on a selected tile with a modifier key deselects it
            self.selectedTileIds.splice(tileIdIndex, 1);
          }
          else {
            self.selectedTileIds.push(tileId);
          }
        } else if (options?.dragging) {
          // dragging a tile adds it to the selection
          if (!isCurrentlySelected) {
            self.selectedTileIds.push(tileId);
          }
        } else if (!options?.dragging) {
          self.selectedTileIds.replace([tileId]);
        }
        // clicking on an already-selected tile doesn't change selection
      } else {
        self.selectedTileIds.clear();
      }
    };

    const selectAllTiles = (tileIds: string[]) => {
      self.selectedTileIds.replace(tileIds);
    };

    return {
      alert,
      prompt,
      confirm,
      resolveDialog,

      setAnnotationMode(mode?: string) {
        self.annotationMode = mode;
      },


      setError(error: unknown, customMessage?: string, content?: React.FC<any>) {
        self.error = customMessage ?? String(error);
        self.errorContent = content;
        Logger.log(LogEventName.INTERNAL_ERROR_ENCOUNTERED, { message: self.error });
        if (error instanceof Error) {
          // In Chrome, passing an error instance to console.error() will print the
          // message and the stack. This is useful to find the original error. It
          // does not show async chaining like Chrome does when it shows the stack
          // trace directly from an uncaught error or the trace of the console.error
          // itself. Even without the extra detail, this trace is useful for debugging.
          if (customMessage) {
            console.error(customMessage, error);
          } else {
            console.error(error);
          }
        } else {
          console.error(self.error);
        }
      },
      clearError() {
        self.error = null;
        self.errorContent = undefined;
      },

      setSelectedTile(tile?: ITileModel, options?: {append: boolean, dragging?: boolean}) {
        setOrAppendTileIdToSelection(tile && tile.id, options);
      },
      setSelectedTileId(tileId: string, options?: {append: boolean, dragging?: boolean}) {
        setOrAppendTileIdToSelection(tileId, options);
      },
      removeTileIdFromSelection(tileId: string) {
        self.selectedTileIds.remove(tileId);
      },
      setScrollTo(tileId: string, docId: string) {
        self.scrollTo = ScrollToModel.create({ tileId, docId });
      },
      setShowDemoCreator(showDemoCreator: boolean) {
        self.showDemoCreator = showDemoCreator;
      },
      closeDialog,

      setDraggingId(dragId?: string) {
        self.dragId = dragId;
      },

      selectAllTiles,

      getCopyToDocumentKey,

      setStandalone(standalone: boolean) {
        self.standalone = standalone;
      }
    };
  })
  .actions(self => ({
    clearSelectedTiles() {
      self.selectedTileIds.forEach(tileId => self.removeTileIdFromSelection(tileId));
    },

    setExpandedSortWorkSections(docGroupLabel: string, expand: boolean) {
      if (expand) {
        self.expandedSortWorkSections.push(docGroupLabel);
      } else {
        self.expandedSortWorkSections.remove(docGroupLabel);
      }
    },

    setHighlightedSortWorkDocument(docId: string) {
      self.highlightedSortWorkDocument = docId;
    },

    clearHighlightedSortWorkDocument() {
      self.highlightedSortWorkDocument = undefined;
    },

    clearExpandedSortWorkSections() {
      self.expandedSortWorkSections.clear();
    }
}));
export type UIModelType = typeof UIModel.Type;
export type UIDialogModelType = typeof UIDialogModel.Type;

export function selectTile(ui: UIModelType, model: ITileModel, isExtending?: boolean) {
  ui.setSelectedTile(model, { append: !!isExtending });
}

// Sometimes we get multiple selection events for a single click.
// We only want to respond once per such burst of selection events.
export const debouncedSelectTile = debounce(selectTile, 50);
