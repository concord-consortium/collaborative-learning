import { getSnapshot, SnapshotIn, types } from "mobx-state-tree";
import { debounce } from "lodash";
import { AppConfigModelType } from "./app-config-model";
import { kDividerHalf, kDividerMax, kDividerMin, UIDialogTypeEnum } from "./ui-types";
import { WorkspaceModel } from "./workspace";
import { DocumentModelType } from "../document/document";
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { ITileModel } from "../tiles/tile-model";
import { ENavTab } from "../view/nav-tabs";
import { buildSectionPath, getCurriculumMetadata } from "../../../functions/src/shared";
import { LearningLogDocument, LearningLogPublication, PersonalDocument,
  PersonalPublication, PlanningDocument, ProblemDocument,
  ProblemPublication, SupportPublication } from "../document/document-types";
import { UserModelType } from "./user";

export const kSparrowAnnotationMode = "sparrow";

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
    rows: types.maybe(types.number)
  })
  .volatile(self => ({
    promptValue: self.defaultValue
  }))
  .actions(self => ({
    setPromptValue(value: string) {
      self.promptValue = value;
    }
  }));
type UIDialogModelSnapshot = SnapshotIn<typeof UIDialogModel>;
type UIDialogModelSnapshotWithoutType = Omit<UIDialogModelSnapshot, "type">;

// This generic model should work for both the problem tab, and the MyWork/ClassWork tabs
// The StudentWorkspaces tab might work this way too. It has an open group which could be
// stored in the openSubTab. And then it might have an open'd student document of the group
// this would be the openDocument.
export const UITabModel = types
  .model("UITab", {
    id: types.identifier,
    openSubTab: types.maybe(types.string),
    // The key of this map is the sub tab label
    openDocuments: types.map(types.string),
    openSecondaryDocuments: types.map(types.string)
  });

export const PersistentUIModel = types
  .model("PersistentUI", {
    annotationMode: types.maybe(types.string),
    dividerPosition: kDividerHalf,
    error: types.maybeNull(types.string),
    activeNavTab: ENavTab.kProblems,
    selectedTileIds: types.array(types.string),
    selectedCommentId: types.maybe(types.string),
    scrollTo: types.maybe(ScrollToModel),
    showAnnotations: true,
    showDemo: false,
    showDemoCreator: false,
    showTeacherContent: true,
    showChatPanel: false,
    dialog: types.maybe(UIDialogModel),
    tabs: types.map(UITabModel),
    problemWorkspace: WorkspaceModel,
    learningLogWorkspace: WorkspaceModel,
    teacherPanelKey: types.maybe(types.string),
    dragId: types.maybe(types.string) // The id of the object being dragged. Used with dnd-kit dragging.
  })
  .volatile(self => ({
    defaultLeftNavExpanded: false,
    problemPath: ""
  }))
  .views((self) => ({
    isSelectedTile(tile: ITileModel) {
      return self.selectedTileIds.indexOf(tile.id) !== -1;
    },
    get navTabContentShown () {
      return self.dividerPosition > kDividerMin;
    },
    get workspaceShown () {
      return self.dividerPosition < kDividerMax;
    },
    get openSubTab () {
      return self.tabs.get(self.activeNavTab)?.openSubTab;
    },
  }))
  .views((self) => ({
    // document key or section path for resource (left) document
    get focusDocument () {
      if (self.activeNavTab === ENavTab.kProblems || self.activeNavTab === ENavTab.kTeacherGuide) {
        const facet = self.activeNavTab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.openSubTab, facet);
      } else {
        const activeTabState = self.tabs.get(self.activeNavTab);
        return self.openSubTab && activeTabState?.openDocuments.get(self.openSubTab);
      }
    },
    get focusSecondaryDocument () {
      if (self.activeNavTab === ENavTab.kProblems || self.activeNavTab === ENavTab.kTeacherGuide) {
        const facet = self.activeNavTab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.openSubTab, facet);
      } else {
        const activeTabState = self.tabs.get(self.activeNavTab);
        return self.openSubTab && activeTabState?.openSecondaryDocuments.get(self.openSubTab);
      }
    },
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

    const setOrAppendTileIdToSelection = (tileId?: string, options?: {append: boolean}) => {
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
        } else if (!isCurrentlySelected) {
          self.selectedTileIds.replace([tileId]);
        }
        // clicking on an already-selected tile doesn't change selection
      } else {
        self.selectedTileIds.clear();
      }
    };

    const getTabState = (tab: string) => {
      let tabState = self.tabs.get(tab);
      if (!tabState) {
        tabState = UITabModel.create({id: tab});
        self.tabs.put(tabState);
      }
      return tabState;
    };

    return {
      alert,
      prompt,
      confirm,
      resolveDialog,

      setAnnotationMode(mode?: string) {
        self.annotationMode = mode;
      },
      setDividerPosition(position: number) {
        self.dividerPosition = position;
      },
      setShowAnnotations(show: boolean) {
        self.showAnnotations = show;
      },
      toggleShowTeacherContent(show: boolean) {
        self.showTeacherContent = show;
      },
      toggleShowChatPanel(show:boolean) {
        self.showChatPanel = show;
      },
      setError(error: string) {
        self.error = error ? error.toString() : error;
        Logger.log(LogEventName.INTERNAL_ERROR_ENCOUNTERED, { message: self.error });
        console.error(self.error);
      },
      clearError() {
        self.error = null;
      },
      setActiveNavTab(tab: string) {
        self.activeNavTab = tab;
      },
      setSelectedTile(tile?: ITileModel, options?: {append: boolean}) {
        setOrAppendTileIdToSelection(tile && tile.id, options);
      },
      setSelectedTileId(tileId: string, options?: {append: boolean}) {
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
      rightNavDocumentSelected(appConfig: AppConfigModelType, document: DocumentModelType) {
        if (!document.isPublished || appConfig.showPublishedDocsInPrimaryWorkspace) {
          self.problemWorkspace.setAvailableDocument(document);
        }
        else if (document.isPublished) {
          if (self.problemWorkspace.primaryDocumentKey) {
            self.problemWorkspace.setComparisonDocument(document);
            self.problemWorkspace.toggleComparisonVisible({override: true});
          }
          else {
            alert("Please select a primary document first.", "Select Primary Document");
          }
        }
      },
      setTeacherPanelKey(key: string) {
        self.teacherPanelKey = key;
      },
      setDraggingId(dragId?: string) {
        self.dragId = dragId;
      },
      // We could switch this to openSubTab, however that would imply that the activeTab would be
      // switched if this is called. When all of the tabs are initialized this is called to setup
      // the default sub tab or each main tab, so we don't want to be switching the activeTab in
      // that case.
      setOpenSubTab(tab: string, subTab: string) {
        const tabState = getTabState(tab);
        tabState.openSubTab = subTab;
      },
      /**
       * Set the open document in a sub tab. Do not actually open
       * the navTab or subTab.
       *
       * @param tab
       * @param subTab
       * @param documentKey
       */
      setOpenSubTabDocument(tab: string, subTab: string, documentKey: string) {
        const tabState = getTabState(tab);
        tabState.openDocuments.set(subTab, documentKey);
      },
      setOpenSubTabSecondaryDocument(tab: string, subTab: string, documentKey: string) {
        const tabState = getTabState(tab);
        tabState.openDocuments.set(subTab, documentKey);
      },
      /**
       * Open to the tab and subTab and open a document.
       *
       * @param tab
       * @param subTab
       * @param documentKey
       */
      openSubTabDocument(tab: string, subTab: string, documentKey: string) {
        const tabState = getTabState(tab);
        self.activeNavTab = tab;
        tabState.openSubTab = subTab;
        tabState.openDocuments.set(subTab, documentKey);
      },
      openSubTabSecondaryDocument(tab: string, subTab: string, documentKey: string) {
        const tabState = getTabState(tab);
        self.activeNavTab = tab;
        tabState.openSubTab = subTab;
        tabState.openSecondaryDocuments.set(subTab, documentKey);
      },
      closeSubTabDocument(tab: string, subTab: string) {
        const tabState = getTabState(tab);
        tabState.openDocuments.delete(subTab);
      },
      closeSubTabSecondaryDocument(tab: string, subTab: string) {
        const tabState = getTabState(tab);
        tabState.openSecondaryDocuments.delete(subTab);
      },
      setProblemPath(problemPath: string) {
        self.problemPath = problemPath;
      }
    };
  })
  .actions(self => ({
    clearSelectedTiles() {
      self.selectedTileIds.forEach(tileId => self.removeTileIdFromSelection(tileId));
    },
    /**
     * Update the top level tab in the resources panel (left side), and guess a sub tab to open to view
     * this document. Currently this only works with non curriculum docs.
     *
     * @param doc a non curriculum document
     */
    openResourceDocument(doc: DocumentModelType, user?: UserModelType) {
      const navTab = getNavTabOfDocument(doc, user)  || "";
      let subTab = "";
      if (navTab === ENavTab.kClassWork) {
        if (doc.type === LearningLogPublication) {
          // FIXME: if the subTabs are renamed in the unit then this won't
          // work
          subTab = "Learning Logs";
        } else {
          subTab = "Workspaces";
        }
      }
      if (navTab === ENavTab.kMyWork) {
        if (doc.type === LearningLogDocument) {
          subTab = "Learning Log";
        } else {
          subTab = "Workspaces";
        }
      }
      if (navTab === ENavTab.kStudentWork){
        const groupId = doc.groupId;
        if (groupId) {
          subTab = groupId;
        }
      }

      if (!subTab) {
        console.warn("Can't find subTab for doc", getSnapshot(doc));
        return;
      }
      self.openSubTabDocument(navTab, subTab, doc.key);
    },

    openCurriculumDocument(docPath: string) {
      const {navTab, subTab} = getTabsOfCurriculumDoc(docPath);
      if (!subTab) {
        console.warn("Can't find subTab in curriculum documentPath", docPath);
        return;
      }
      self.setActiveNavTab(navTab);
      self.setOpenSubTab(navTab, subTab);
    }
}));

export type PersistentUIModelType = typeof PersistentUIModel.Type;
export type UIDialogModelType = typeof UIDialogModel.Type;

export function selectTile(ui: PersistentUIModelType, model: ITileModel, isExtending?: boolean) {
  ui.setSelectedTile(model, { append: !!isExtending });
}

// Sometimes we get multiple selection events for a single click.
// We only want to respond once per such burst of selection events.
export const debouncedSelectTile = debounce(selectTile, 50);

// Maybe this should return the navTab and subTab
export function getTabsOfCurriculumDoc(docPath: string) {
  const {facet,section} = getCurriculumMetadata(docPath) || {};
  return {
    navTab: facet === "guide" ? ENavTab.kTeacherGuide : ENavTab.kProblems,
    subTab: section
  };
}

const docTypeToNavTab: Record<string, ENavTab | undefined> = {
  // MyWork
  [ProblemDocument]: ENavTab.kMyWork,
  [PlanningDocument]: ENavTab.kMyWork,
  [LearningLogDocument]: ENavTab.kMyWork,
  [PersonalDocument]: ENavTab.kMyWork,

  // ClassWork
  [ProblemPublication]: ENavTab.kClassWork,
  [LearningLogPublication]: ENavTab.kClassWork,
  [PersonalPublication]: ENavTab.kClassWork,
  [SupportPublication]: ENavTab.kClassWork,
};


export function isStudentWorkspaceDoc (doc: DocumentModelType, userId: string) {
  return userId !== doc.uid && doc.type === ProblemDocument;
}

export function getNavTabOfDocument(doc: DocumentModelType, user?: UserModelType) {
    if (user && isStudentWorkspaceDoc(doc, user?.id)){
      return ENavTab.kStudentWork;
    } else {
      return docTypeToNavTab[doc.type];
    }
}
