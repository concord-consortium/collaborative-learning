import {
  getSnapshot, applySnapshot, types, onSnapshot, SnapshotIn, Instance
} from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { buildSectionPath, getCurriculumMetadata } from "../../../../shared/shared";
import { DB } from "../../../lib/db";
import { safeJsonParse } from "../../../utilities/js-utils";
import { removeLoadingMessage, showLoadingMessage } from "../../../utilities/loading-utils";
import { isValidSortTypeId } from "../../../utilities/translation/translation-types";
import { urlParams } from "../../../utilities/url-params";
import { DocumentModelType } from "../../document/document";
import {
  ExemplarDocument, LearningLogDocument, LearningLogPublication, PersonalDocument, PersonalPublication,
  PlanningDocument, ProblemDocument, ProblemPublication, SupportPublication
} from "../../document/document-types";
import { ENavTab, NavTabModelType } from "../../view/nav-tabs";
import { AppConfigModelType } from "../app-config-model";
import { SortedDocuments } from "../sorted-documents";
import {
  DocFilterType, DocFilterTypeEnum, kDividerHalf, kDividerMax, kDividerMin, PrimarySortType
} from "../ui-types";
import { UserModelType } from "../user";
import { isWorkspaceModelSnapshot, WorkspaceModel } from "../workspace";
import { UITabModel, UITabModel_V1 } from "./ui-tab-model";

export const kPersistentUiStateVersion2 = "2.0.0";
export const kPersistentUiStateVersion1 = "1.0.0";

export const PersistentUIModelV2 = types
  .model("PersistentUI", {
    dividerPosition: kDividerHalf,
    activeNavTab: types.maybe(types.string),
    docFilter: types.optional(DocFilterTypeEnum, "Problem"),
    primarySortBy: types.optional(types.string, "Group"),
    secondarySortBy: types.optional(types.string, "None"),
    thumbnailDisplay: types.optional(types.string, "Small"),
    showAnnotations: true,
    showTeacherContent: true,
    showChatPanel: false,
    showDocumentScroller: true,
    tabs: types.map(UITabModel),
    problemWorkspace: WorkspaceModel,
    teacherPanelKey: types.maybe(types.string),
    version: types.optional(types.literal(kPersistentUiStateVersion2), kPersistentUiStateVersion2),
  })
  .volatile(self => ({
    defaultLeftNavExpanded: false,
    problemPath: ""
  }))
  .views((self) => ({
    get navTabContentShown () {
      return self.dividerPosition > kDividerMin;
    },
    get workspaceShown () {
      return self.dividerPosition < kDividerMax;
    },
    get currentDocumentGroupId () {
      return self.activeNavTab && self.tabs.get(self.activeNavTab)?.currentDocumentGroupId;
    },
    get activeTabModel () {
      if (!self.activeNavTab) return undefined;
      return self.tabs.get(self.activeNavTab);
    }
  }))
  .views((self) => ({
    // document key or section path for resource (left) document
    get focusDocument () {
      if (self.activeNavTab === ENavTab.kProblems || self.activeNavTab === ENavTab.kTeacherGuide) {
        const facet = self.activeNavTab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.currentDocumentGroupId, facet);
      } else {
        return self.activeTabModel?.currentDocumentGroup?.primaryDocumentKey;
      }
    },
    get focusSecondaryDocument () {
      if (self.activeNavTab === ENavTab.kProblems || self.activeNavTab === ENavTab.kTeacherGuide) {
        const facet = self.activeNavTab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.currentDocumentGroupId, facet);
      } else {
        return self.activeTabModel?.currentDocumentGroup?.secondaryDocumentKey;
      }
    },
  }))
  .actions(self => ({
    setDividerPosition(position: number) {
      self.dividerPosition = position;
    },
    setShowAnnotations(show: boolean) {
      self.showAnnotations = show;
    },
    toggleShowTeacherContent(show: boolean) {
      self.showTeacherContent = show;
    },
    toggleShowChatPanel(show: boolean) {
      self.showChatPanel = show;
    },
    toggleShowDocumentScroller(show: boolean) {
      self.showDocumentScroller = show;
    },
    setActiveNavTab(tab: string) {
      self.activeNavTab = tab;
    },
    getOrCreateTabState(tab: string) {
      let tabState = self.tabs.get(tab);
      if (!tabState) {
        tabState = UITabModel.create({id: tab});
        self.tabs.put(tabState);
      }
      return tabState;
    }
  }))
  .actions((self) => ({
    /**
     * Set the active tab to the first tab if:
     * - the active tab is not already set
     * - the active tab no longer exists in the list of tabs
     * @param tabSpecs
     */
    initializeActiveNavTab(tabSpecs: NavTabModelType[]) {
      if (tabSpecs.length > 0) {
        // An author might remove or rename a tab, so we check that the activeNavTab actually exists
        const validActiveNavTab = tabSpecs.find(tab => tab.tab === self.activeNavTab);
        if (!validActiveNavTab) {
          self.setActiveNavTab(tabSpecs[0].tab);
        }
      }
    },
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
          alert("Please select a primary document first.");
        }
      }
    },
    setTeacherPanelKey(key: string) {
      self.teacherPanelKey = key;
    },
    /**
     * Set this document group of tab to be open. It does **not** open the tab, just the document group.
     * So it will **not** necessarily show this document group to the user. This is useful so code can
     * initialize a default document group without changing what the user is currently seeing.
     *
     * @param tab
     * @param docGroupId
     */
    setCurrentDocumentGroupId(tab: string, docGroupId: string) {
      const tabState = self.getOrCreateTabState(tab);
      tabState.currentDocumentGroupId = docGroupId;
    },
    /**
     * Set the open document in a document group. Do not actually open
     * the navTab or document group.
     *
     * @param tab
     * @param docGroupId
     * @param documentKey
     */
    setDocumentGroupPrimaryDocument(tab: string, docGroupId: string, documentKey: string) {
      const tabState = self.getOrCreateTabState(tab);
      tabState.setDocumentGroupPrimaryDocument(docGroupId, documentKey);
    },
    /**
     * Open to the tab and document group and open a document.
     *
     * @param tab
     * @param docGroupId
     * @param documentKey
     */
    openDocumentGroupPrimaryDocument(tab: string, docGroupId: string, documentKey: string) {
      const tabState = self.getOrCreateTabState(tab);
      self.activeNavTab = tab;
      tabState.openDocumentGroupPrimaryDocument(docGroupId, documentKey);
    },
    openDocumentGroupSecondaryDocument(tab: string, docGroupId: string, documentKey: string) {
      const tabState = self.getOrCreateTabState(tab);
      self.activeNavTab = tab;
      tabState.setDocumentGroupSecondaryDocument(docGroupId, documentKey);
      tabState.currentDocumentGroupId = docGroupId;
    },
    // Defaults to the current tab and document group
    closeDocumentGroupPrimaryDocument(
      tab: string|undefined=self.activeNavTab, docGroupId: string|undefined=self.currentDocumentGroupId
    ) {
      if (tab && docGroupId) {
        const tabState = self.getOrCreateTabState(tab);
        // We create the group if it doesn't exist, so we can save the state indicating the user
        // explicitly closed the document
        const group = tabState.getOrCreateDocumentGroup(docGroupId);
        group.closePrimaryDocument();
      }
    },
    closeDocumentGroupSecondaryDocument(tab: string, docGroupId: string) {
      const tabState = self.getOrCreateTabState(tab);
      const group = tabState.visitedDocumentGroups.get(docGroupId);
      group?.closeSecondaryDocument();
    },
    setProblemPath(problemPath: string) {
      self.problemPath = problemPath;
    },
    setDocFilter(docFilter: DocFilterType) {
      self.docFilter = docFilter;
    },
    setPrimarySortBy(sort: string) {
      self.primarySortBy = sort;
    },
    setSecondarySortBy(sort: string) {
      self.secondarySortBy = sort;
    },
    setThumbnailDisplay(display: string) {
      self.thumbnailDisplay = display;
    }
  }))
  .actions(self => ({
    /**
     * Update the top level tab in the resources panel (left side), and guess a sub tab to open to view
     * this document. Currently this only works with non curriculum docs.
     *
     * @param doc a non curriculum document
     */
    openResourceDocument(
      doc: DocumentModelType,
      appConfig: AppConfigModelType,
      user?: UserModelType,
      sortedDocuments?: SortedDocuments,
      opts?: { fromUrlStudentDocument?: boolean }
    ) {
      const { aiEvaluation, navTabs } = appConfig || {};
      const availableTabs = navTabs?.tabSpecs.map(tab => tab.tab) ?? [];
      let navTab = "";

      if (opts?.fromUrlStudentDocument) {
        navTab = ENavTab.kStudentWork;
      } else if (aiEvaluation) {
        if (availableTabs.includes(ENavTab.kSortWork)) {
          navTab = ENavTab.kSortWork;
        } else if (availableTabs.includes(ENavTab.kMyWork)) {
          navTab = ENavTab.kMyWork;
        }
      }

      if (!navTab) {
        navTab = getNavTabOfDocument(doc, user) || "";
      }

      let docGroupId = "";
      if (navTab === ENavTab.kClassWork) {
        if (doc.type === LearningLogPublication) {
          // FIXME: if the subTabs are renamed in the unit then this won't
          // work
          docGroupId = "Learning Logs";
        } else {
          docGroupId = "Workspaces";
        }
      }
      if (navTab === ENavTab.kMyWork) {
        if (doc.type === LearningLogDocument) {
          docGroupId = "Learning Log";
        } else {
          docGroupId = "Workspaces";
        }
      }
      if (navTab === ENavTab.kStudentWork){
        const groupId = doc.groupId;
        if (groupId) {
          docGroupId = groupId;
        }
      }
      if (navTab === ENavTab.kSortWork) {
        if (doc.type === ExemplarDocument) {
          const sortedDocumentGroups = sortedDocuments?.sortBy("Strategy");
          const openGroup = sortedDocumentGroups?.find(group => group.documents.some((d) => d.key === doc.key));
          docGroupId = JSON.stringify({primaryLabel: openGroup?.label, "primaryType": "Strategy"});
          self.setPrimarySortBy("Strategy");
          self.setSecondarySortBy("None");
        } else {
          if (sortedDocuments) {
            if (aiEvaluation) {
              self.setPrimarySortBy("Name");
            }
            const primarySortBy: PrimarySortType =
              isValidSortTypeId(self.primarySortBy) ? self.primarySortBy : "Group";
            const sortedDocumentGroups = sortedDocuments?.sortBy(primarySortBy);
            const openGroup = sortedDocumentGroups?.find(group => group.documents.some((d) => d.key === doc.key));
            docGroupId = JSON.stringify({"primaryLabel": openGroup?.label, "primaryType": primarySortBy});
          }
        }
      }

      if (!docGroupId) {
        console.warn("Can't find document group for doc", getSnapshot(doc));
        return;
      }
      self.openDocumentGroupPrimaryDocument(navTab, docGroupId, doc.key);
    },
    openCurriculumDocument(docPath: string) {
      const {navTab, subTab} = getTabsOfCurriculumDoc(docPath);
      if (!subTab) {
        console.warn("Can't find subTab in curriculum documentPath", docPath);
        return;
      }
      self.setActiveNavTab(navTab);
      self.setCurrentDocumentGroupId(navTab, subTab);
    },
    async initializePersistentUISync(user: UserModelType, db: DB) {
      if (urlParams.noPersistentUI) return;
      showLoadingMessage("Loading current activity");
      const path = db.firebase.getPersistentUIPath(user);
      const getRef = db.firebase.ref(path);
      const theData: string | undefined = (await getRef.once("value"))?.val();
      const asObj = safeJsonParse(theData);
      if (asObj) {
        // As of CLUE 5.3, comparison mode should only be available in the bookmarks tab.
        // Due to a yet-to-be-determined bug, it can be saved in the PersistentUI in other situations in which it
        // results in wonky bug situations, e.g. https://www.pivotaltracker.com/n/projects/2441242/stories/187087979.
        // For now, we always clear comparison mode on load.
        // TODO: Track down the ultimate cause and then only clear the comparison mode when necessary/appropriate.
        const { problemWorkspace } = asObj;
        if (isWorkspaceModelSnapshot(problemWorkspace)) {
          problemWorkspace.comparisonDocumentKey = undefined;
          problemWorkspace.comparisonVisible = false;
        }
        const migratedSnapshot = persistentUIModelPreProcessor(asObj);
        applySnapshot(self, migratedSnapshot);
      }
      removeLoadingMessage("Loading current activity");

      onSnapshot(self, (snapshot)=>{
        const snapshotStr = JSON.stringify(snapshot);
        const updateRef = db.firebase.ref(path);
        updateRef.set(snapshotStr);
      });
    }
}));

export interface PersistentUIModelV1Snapshot extends
  Omit<SnapshotIn<typeof PersistentUIModelV2>, "version" | "tabs">
  {
    version: typeof kPersistentUiStateVersion1,
    tabs: Record<string, UITabModel_V1>
  }

export interface PersistentUIModelV2Snapshot extends SnapshotIn<typeof PersistentUIModelV2> {}

export function persistentUIModelPreProcessor(_snapshot: unknown) {
  const snapshot = _snapshot as PersistentUIModelV1Snapshot | PersistentUIModelV2Snapshot;
  if (snapshot.version === kPersistentUiStateVersion1) {
    const migrated = cloneDeep(snapshot) as unknown as PersistentUIModelV2Snapshot;
    migrated.version = kPersistentUiStateVersion2;
    const migratedTabs: NonNullable<PersistentUIModelV2Snapshot["tabs"]> = {};
    migrated.tabs = migratedTabs;
    Object.keys(snapshot.tabs).forEach(tabKey => {
      const snapshotTab = snapshot.tabs[tabKey];

      const visitedDocumentGroups: NonNullable<SnapshotIn<typeof UITabModel>["visitedDocumentGroups"]> = {};
      Object.keys(snapshotTab.openDocuments).forEach(docGroupId => {
        visitedDocumentGroups[docGroupId] = {
          id: docGroupId,
          currentDocumentKeys: [snapshotTab.openDocuments[docGroupId]]
        };
      });
      Object.keys(snapshotTab.openSecondaryDocuments).forEach(docGroupId => {
        const documentKey = snapshotTab.openSecondaryDocuments[docGroupId];
        const existingGroup = visitedDocumentGroups[docGroupId];
        if (existingGroup && existingGroup.currentDocumentKeys) {
          (existingGroup.currentDocumentKeys as string[]).push(documentKey);
          return;
        }
        visitedDocumentGroups[docGroupId] = {
          id: docGroupId,
          currentDocumentKeys: [snapshotTab.openSecondaryDocuments[docGroupId]]
        };
      });
      migratedTabs[tabKey] = {
        id: tabKey,
        currentDocumentGroupId: snapshotTab.openSubTab,
        visitedDocumentGroups
      };
    });
    return migrated;
  } else {
    return snapshot as unknown as SnapshotIn<typeof PersistentUIModelV2>;
  }
}

export const PersistentUIModel = types.snapshotProcessor(PersistentUIModelV2, {
  preProcessor: persistentUIModelPreProcessor
});

export interface PersistentUIModelType extends Instance<typeof PersistentUIModel> {}


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

  // Other
  [ExemplarDocument]: ENavTab.kSortWork,
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
