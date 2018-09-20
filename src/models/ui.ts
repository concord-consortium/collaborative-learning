import { types } from "mobx-state-tree";
import { SectionWorkspaceModelType, LearningLogWorkspaceModelType } from "./workspaces";

export type ToggleElement = "rightNavExpanded" | "leftNavExpanded" | "bottomNavExpanded";

export const UIModel = types
  .model("UI", {
    rightNavExpanded: false,
    leftNavExpanded: false,
    bottomNavExpanded: false,
    error: types.maybeNull(types.string),
    activeSectionIndex: 0,
    activeRightNavTab: "My Work",
    primaryWorkspaceDocumentKey: types.maybe(types.string),
    comparisonWorkspaceDocumentKey: types.maybe(types.string),
    comparisonWorkspaceVisible: false,
    llPrimaryWorkspaceDocumentKey: types.maybe(types.string),
    llComparisonWorkspaceDocumentKey: types.maybe(types.string),
    llComparisonWorkspaceVisible: false,
    showDemo: false,
    showDemoCreator: false,
  })
  .views((self) => ({
    get allContracted() {
      return !self.rightNavExpanded && !self.leftNavExpanded && !self.bottomNavExpanded;
    },
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
      setAvailableWorkspace(workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) {
        if (self.comparisonWorkspaceVisible) {
          setComparisonWorkspace(workspace);
        }
        else {
          setPrimaryWorkspace(workspace);
        }
      },
      setShowDemo(showDemo: boolean) {
        self.showDemoCreator = showDemo;
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
      }
    };
  });

export type UIModelType = typeof UIModel.Type;
