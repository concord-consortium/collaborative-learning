import { types } from "mobx-state-tree";
import { SectionWorkspaceModelType, LearningLogWorkspaceModelType } from "./workspaces";
import { ToolTileModelType } from "./tools/tool-tile";

export type ToggleElement = "rightNavExpanded" | "leftNavExpanded" | "bottomNavExpanded";

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
    bottomNavExpanded: false,
    error: types.maybeNull(types.string),
    activeSectionIndex: 0,
    activeRightNavTab: "My Work",
    selectedTileId: types.maybe(types.string),
    primaryWorkspaceDocumentKey: types.maybe(types.string),
    comparisonWorkspaceDocumentKey: types.maybe(types.string),
    comparisonWorkspaceVisible: false,
    llPrimaryWorkspaceDocumentKey: types.maybe(types.string),
    llComparisonWorkspaceDocumentKey: types.maybe(types.string),
    llComparisonWorkspaceVisible: false,
    showDemo: false,
    showDemoCreator: false,
    dialog: types.maybe(UIDialogModel),
  })
  .views((self) => ({
    get allContracted() {
      return !self.rightNavExpanded && !self.leftNavExpanded && !self.bottomNavExpanded;
    },
    isSelectedTile(tile: ToolTileModelType) {
      return (tile.id === self.selectedTileId);
    }
  }))
  .actions((self) => {
    const contractAll = () => {
      self.rightNavExpanded = false;
      self.leftNavExpanded = false;
      self.bottomNavExpanded = false;
    };

    const toggleWithOverride = (toggle: ToggleElement, override?: boolean) => {
      const expanded = typeof override !== "undefined" ? override : !self[toggle];

      switch (toggle) {
        case "leftNavExpanded":
          self.leftNavExpanded = expanded;
          self.rightNavExpanded = false;
          self.bottomNavExpanded = false;
          break;
        case "rightNavExpanded":
          self.rightNavExpanded = expanded;
          self.leftNavExpanded = false;
          break;
        case "bottomNavExpanded":
          self.bottomNavExpanded = expanded;
          self.leftNavExpanded = false;
          break;
      }
    };

    const setPrimaryWorkspace = (workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) => {
      self.primaryWorkspaceDocumentKey = workspace ? workspace.document.key : undefined;
    };

    const setComparisonWorkspace = (workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) => {
      self.comparisonWorkspaceDocumentKey = workspace ? workspace.document.key : undefined;
    };

    const setLLPrimaryWorkspace = (workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) => {
      self.llPrimaryWorkspaceDocumentKey = workspace ? workspace.document.key : undefined;
    };

    const setLLComparisonWorkspace = (workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) => {
      self.llComparisonWorkspaceDocumentKey = workspace ? workspace.document.key : undefined;
    };

    const closeDialog = () => {
      self.dialog = undefined;
      dialogResolver = undefined;
    };

    return {
      contractAll,
      setPrimaryWorkspace,
      setComparisonWorkspace,
      setLLPrimaryWorkspace,
      setLLComparisonWorkspace,

      toggleLeftNav(override?: boolean) {
        toggleWithOverride("leftNavExpanded", override);
      },
      toggleRightNav(override?: boolean) {
        toggleWithOverride("rightNavExpanded", override);
      },
      toggleBottomNav(override?: boolean) {
        toggleWithOverride("bottomNavExpanded", override);
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
      setSelectedTile(tile?: ToolTileModelType) {
        self.selectedTileId = tile ? tile.id : undefined;
      },
      setAvailableWorkspace(workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) {
        if (self.comparisonWorkspaceVisible) {
          setComparisonWorkspace(workspace);
        }
        else {
          setPrimaryWorkspace(workspace);
        }
      },
      setShowDemoCreator(showDemoCreator: boolean) {
        self.showDemoCreator = showDemoCreator;
      },
      toggleComparisonWorkspaceVisible(override?: boolean) {
        const visible = typeof override !== "undefined" ? override : !self.comparisonWorkspaceVisible;
        self.comparisonWorkspaceVisible = visible;
        if (!visible) {
          self.comparisonWorkspaceDocumentKey = undefined;
        }
      },
      setAvailableLLWorkspace(workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) {
        if (self.llComparisonWorkspaceVisible) {
          setLLComparisonWorkspace(workspace);
        }
        else {
          setLLPrimaryWorkspace(workspace);
        }
      },
      toggleLLComparisonWorkspaceVisible(override?: boolean) {
        const visible = typeof override !== "undefined" ? override : !self.llComparisonWorkspaceVisible;
        self.llComparisonWorkspaceVisible = visible;
        if (!visible) {
          self.llComparisonWorkspaceDocumentKey = undefined;
        }
      },
      alert(text: string, title?: string) {
        self.dialog = UIDialogModel.create({type: "alert", text, title});
        dialogResolver = undefined;
      },
      confirm(text: string, title?: string) {
        self.dialog = UIDialogModel.create({type: "confirm", text, title});
        return new Promise<boolean>((resolve, reject) => {
          dialogResolver = resolve;
        });
      },
      prompt(text: string, defaultValue: string = "", title?: string) {
        self.dialog = UIDialogModel.create({type: "prompt", text, defaultValue, title});
        return new Promise<string>((resolve, reject) => {
          dialogResolver = resolve;
        });
      },
      resolveDialog(value: string | boolean) {
        if (dialogResolver) {
          dialogResolver(value);
        }
        closeDialog();
      },
      closeDialog
    };
  });

export type UIModelType = typeof UIModel.Type;
export type UIDialogModelType = typeof UIDialogModel.Type;
