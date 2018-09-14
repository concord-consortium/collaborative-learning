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

      contractAll();

      switch (toggle) {
        case "rightNavExpanded":
          self.rightNavExpanded = expanded;
          break;
        case "leftNavExpanded":
          self.leftNavExpanded = expanded;
          break;
        case "bottomNavExpanded":
          self.bottomNavExpanded = expanded;
          break;
      }
    };

    const setPrimaryWorkspace = (workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) => {
      self.primaryWorkspaceDocumentKey = workspace ? workspace.document.key : undefined;
    };

    const setComparisonWorkspace = (workspace?: LearningLogWorkspaceModelType | SectionWorkspaceModelType) => {
      self.comparisonWorkspaceDocumentKey = workspace ? workspace.document.key : undefined;
    };

    return {
      contractAll,
      setPrimaryWorkspace,
      setComparisonWorkspace,

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
      closeWorkspace(workspace: LearningLogWorkspaceModelType | SectionWorkspaceModelType) {
        const {key} = workspace.document;
        if (key === self.primaryWorkspaceDocumentKey) {
          self.primaryWorkspaceDocumentKey = undefined;
          self.comparisonWorkspaceDocumentKey = undefined;
          self.comparisonWorkspaceVisible = false;
        }
        else if (key === self.comparisonWorkspaceDocumentKey) {
          self.comparisonWorkspaceDocumentKey = undefined;
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
      }
    };
  });

export type UIModelType = typeof UIModel.Type;
