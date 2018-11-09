import { types } from "mobx-state-tree";
import { WorkspaceModel } from "./workspace";
import { ToolTileModelType } from "./tools/tool-tile";
import { DocumentModelType, PublicationDocument, LearningLogPublication } from "./document";

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
    showDemo: false,
    showDemoCreator: false,
    dialog: types.maybe(UIDialogModel),
    sectionWorkspace: WorkspaceModel,
    learningLogWorkspace: WorkspaceModel,
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
      setSelectedTileId(tileId: string) {
        self.selectedTileId = tileId;
      },
      setShowDemoCreator(showDemoCreator: boolean) {
        self.showDemoCreator = showDemoCreator;
      },
      closeDialog,

      rightNavDocumentSelected(document: DocumentModelType) {
        // learning log
        if (self.bottomNavExpanded) {
          if (self.learningLogWorkspace.primaryDocumentKey) {
            self.learningLogWorkspace.setComparisonDocument(document);
            self.learningLogWorkspace.toggleComparisonVisible({override: true});
          }
          else {
            alert("Please select a Learning Log first.", "Select for Learning Log");
          }
        }
        // class work or log
        else if (document.type === PublicationDocument || document.type === LearningLogPublication) {
          if (self.sectionWorkspace.primaryDocumentKey) {
            self.sectionWorkspace.setComparisonDocument(document);
            self.sectionWorkspace.toggleComparisonVisible({override: true});
          }
          else {
            alert("Please select a primary document first.", "Select Primary Document");
          }
        }
        // my work
        else {
          self.sectionWorkspace.setAvailableDocument(document);
          contractAll();
        }
      }
    };
  });

export type UIModelType = typeof UIModel.Type;
export type UIDialogModelType = typeof UIDialogModel.Type;
