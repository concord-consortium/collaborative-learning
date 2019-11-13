import { types } from "mobx-state-tree";
import { WorkspaceModel } from "./workspace";
import { ToolTileModelType } from "../tools/tool-tile";
import { DocumentModelType } from "../document/document";
import { ERightNavTab } from "../view/right-nav";

export type ToggleElement = "rightNavExpanded" | "leftNavExpanded";

export const UIDialogTypeEnum = types.enumeration("dialogType", ["alert", "confirm", "prompt"]);
export type UIDialogType = typeof UIDialogTypeEnum.Type;

let dialogResolver: ((value?: string | PromiseLike<string> | boolean | PromiseLike<boolean> | undefined) => void) |
                    undefined;

export const UIDialogModel = types
  .model("UIDialog", {
    type: UIDialogTypeEnum,
    text: types.string,
    title: types.maybe(types.string),
    defaultValue: types.maybe(types.string),
  });

export const UIModel = types
  .model("UI", {
    rightNavExpanded: false,
    leftNavExpanded: false,
    error: types.maybeNull(types.string),
    activeSectionIndex: 0,
    activeRightNavTab: ERightNavTab.kMyWork,
    selectedTileIds: types.array(types.string),
    showDemo: false,
    showDemoCreator: false,
    dialog: types.maybe(UIDialogModel),
    problemWorkspace: WorkspaceModel,
    learningLogWorkspace: WorkspaceModel,
    teacherPanelKey: types.maybe(types.string)
  })
  .views((self) => ({
    get allContracted() {
      return !self.rightNavExpanded && !self.leftNavExpanded;
    },
    isSelectedTile(tile: ToolTileModelType) {
      return self.selectedTileIds.indexOf(tile.id) !== -1;
    }
  }))
  .actions((self) => {
    const contractAll = () => {
      self.rightNavExpanded = false;
      self.leftNavExpanded = false;
    };

    const toggleWithOverride = (toggle: ToggleElement, override?: boolean) => {
      const expanded = typeof override !== "undefined" ? override : !self[toggle];

      switch (toggle) {
        case "leftNavExpanded":
          self.leftNavExpanded = expanded;
          self.rightNavExpanded = false;
          break;
        case "rightNavExpanded":
          self.rightNavExpanded = expanded;
          self.leftNavExpanded = false;
          break;
      }
    };

    const alert = (text: string, title?: string) => {
      self.dialog = UIDialogModel.create({type: "alert", text, title});
      dialogResolver = undefined;
    };

    const confirm = (text: string, title?: string) => {
      self.dialog = UIDialogModel.create({type: "confirm", text, title});
      return new Promise<boolean>((resolve, reject) => {
        dialogResolver = resolve;
      });
    };

    const prompt = (text: string, defaultValue: string = "", title?: string) => {
      self.dialog = UIDialogModel.create({type: "prompt", text, defaultValue, title});
      return new Promise<string>((resolve, reject) => {
        dialogResolver = resolve;
      });
    };

    const resolveDialog = (value: string | boolean) => {
      if (dialogResolver) {
        dialogResolver(value);
      }
      closeDialog();
    };

    const closeDialog = () => {
      self.dialog = undefined;
      dialogResolver = undefined;
    };

    const setOrAppendTileIdToSelection = (tileId?: string, options?: {append: boolean}) => {
      if (tileId) {
        if (options && options.append) {
          const index = self.selectedTileIds.indexOf(tileId);
          if (index === -1) {
            self.selectedTileIds.push(tileId);
          }
        } else {
          self.selectedTileIds.replace([tileId]);
        }
      } else {
        self.selectedTileIds.clear();
      }
    };

    return {
      contractAll,
      alert,
      prompt,
      confirm,
      resolveDialog,

      toggleLeftNav(override?: boolean) {
        toggleWithOverride("leftNavExpanded", override);
      },
      toggleRightNav(override?: boolean) {
        toggleWithOverride("rightNavExpanded", override);
      },
      setError(error: string|null) {
        self.error = error ? error.toString() : error;
      },
      setActiveSectionIndex(activeSectionIndex: number) {
        self.activeSectionIndex = activeSectionIndex;
      },
      setActiveRightNavTab(tab: string) {
        self.activeRightNavTab = tab;
      },
      setSelectedTile(tile?: ToolTileModelType, options?: {append: boolean}) {
        setOrAppendTileIdToSelection(tile && tile.id, options);
      },
      setSelectedTileId(tileId: string, options?: {append: boolean}) {
        setOrAppendTileIdToSelection(tileId, options);
      },
      setShowDemoCreator(showDemoCreator: boolean) {
        self.showDemoCreator = showDemoCreator;
      },
      closeDialog,

      rightNavDocumentSelected(document: DocumentModelType) {
        // class work or log
        if (document.isPublished) {
          if (self.problemWorkspace.primaryDocumentKey) {
            self.problemWorkspace.setComparisonDocument(document);
            self.problemWorkspace.toggleComparisonVisible({override: true});
          }
          else {
            alert("Please select a primary document first.", "Select Primary Document");
          }
        }
        // my work
        else {
          self.problemWorkspace.setAvailableDocument(document);
          contractAll();
        }
      },
      setTeacherPanelKey(key: string) {
        self.teacherPanelKey = key;
      }
    };
  });

export type UIModelType = typeof UIModel.Type;
export type UIDialogModelType = typeof UIDialogModel.Type;
