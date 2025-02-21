import {
  getSnapshot, applySnapshot, types, onSnapshot,
  SnapshotIn, Instance, cast
} from "mobx-state-tree";
import { AppConfigModelType } from "../app-config-model";
import {
  DocFilterType, DocFilterTypeEnum, kDividerHalf, kDividerMax,
  kDividerMin, PrimarySortType
} from "../ui-types";
import { isWorkspaceModelSnapshot, WorkspaceModel } from "../workspace";
import { DocumentModelType } from "../../document/document";
import { ENavTab } from "../../view/nav-tabs";
import { buildSectionPath, getCurriculumMetadata } from "../../../../shared/shared";
import {
  ExemplarDocument, LearningLogDocument, LearningLogPublication, PersonalDocument,
  PersonalPublication, PlanningDocument, ProblemDocument,
  ProblemPublication, SupportPublication
} from "../../document/document-types";
import { UserModelType } from "../user";
import { DB } from "../../../lib/db";
import { safeJsonParse } from "../../../utilities/js-utils";
import { urlParams } from "../../../utilities/url-params";
import { removeLoadingMessage, showLoadingMessage } from "../../../utilities/loading-utils";
import { SortedDocuments } from "../sorted-documents";
import { cloneDeep } from "lodash";

export const kPersistentUiStateVersion2 = "2.0.0";
export const kPersistentUiStateVersion1 = "1.0.0";

export const UIDocumentGroup = types
  .model("UIDocumentGroup", {
    id: types.identifier,
    /**
     * Either undefined, an empty array, or an array of document ids.
     * - Undefined means the user hasn't chosen anything yet so we can show a default view
     *   in some cases this might be showing the first document of the listing.
     * - Empty array means the user has explicitly chosen to close the documents and
     *   this typically means they'll be viewing the listing of documents.
     * - The array typically has a single document id, in some cases a second document
     *   can be open at the same time.
     *
     * TODO: another approach for handling the "user hasn't chosen anything yet" case is
     * to look to see if there is a document group at all. Currently the visitedDocumentGroup
     * isn't created until a user actually opens a document. But before making that switch
     * we need to have a working example of this "automaticallyOpenFirstDocument" setting.
     */
    currentDocumentKeys: types.maybe(types.array(types.string))
  })
  .views(self => ({
    get primaryDocumentKey() {
      if (!self.currentDocumentKeys || self.currentDocumentKeys.length < 1) {
        return undefined;
      }
      return self.currentDocumentKeys[0];
    },
    get secondaryDocumentKey() {
      if (!self.currentDocumentKeys || self.currentDocumentKeys.length < 2) {
        return undefined;
      }
      return self.currentDocumentKeys[1];
    },
    get userExplicitlyClosedDocument() {
      return self.currentDocumentKeys?.length === 0;
    }
  }))
  .actions(self => ({
    setPrimaryDocumentKey(documentKey: string) {
      let docKeys = self.currentDocumentKeys;
      if (!docKeys) {
        self.currentDocumentKeys = cast([]);
        docKeys = self.currentDocumentKeys!;
      }

      if (docKeys.length === 0) {
        docKeys.push(documentKey);
      } else if (docKeys.length > 0) {
        docKeys[0] = documentKey;
      }
    },
    /**
     * If there is no primary document we just set the documentKey as the primary document
     * and print a warning in the console
     * @param documentKey
     */
    setSecondaryDocumentKey(documentKey: string) {
      let docKeys = self.currentDocumentKeys;
      if (!docKeys) {
        self.currentDocumentKeys = cast([]);
        docKeys = self.currentDocumentKeys!;
      }

      if (docKeys.length === 0) {
        console.warn("setting a secondary document when there is no primary document");
        docKeys.push(documentKey);
      } else if (docKeys.length === 1) {
        docKeys.push(documentKey);
      } else if (docKeys.length > 1) {
        docKeys[1] = documentKey;
      }
    },
    /**
     * Close the current primary document. If there is a secondary document it will become
     * the primary document.
     * @returns
     */
    closePrimaryDocument() {
      const docKeys = self.currentDocumentKeys;
      if (!docKeys) {
        // The user is taking the explicit action to close the document
        // So we save that as an empty array.
        self.currentDocumentKeys = cast([]);
        return;
      }

      if (docKeys.length === 0) return;

      docKeys.splice(0, 1);
    },
    /**
     *
     * @returns
     */
    closeSecondaryDocument() {
      const docKeys = self.currentDocumentKeys;
      if (!docKeys || docKeys.length < 2) return;

      docKeys.splice(1, 1);
    }
  }));

/**
 * This model is used to track which document group of a tab is open, which documents are open in
 * each document group, and which secondaryDocuments (comparison) documents are open in each
 * document group.
 * For the StudentGroupView the currentDocumentGroupId is the student group id.
 * For the SortWorkView the currentDocumentGroupId in an encoding the filters for group documents
 * that are currently open.
 *
 * TODO: Create different tab types so so the models can more clearly match the UI
 */
export const UITabModel = types
  .model("UITab", {
    id: types.identifier,
    /**
     * The currently open document group on this tab. This could be a subtab, a workgroup,
     * or a collapsible section on the sort work tab.
     */
    currentDocumentGroupId: types.maybe(types.string),
    /**
     * Document groups that the user has visited.
     */
    visitedDocumentGroups: types.map(UIDocumentGroup),
  })
  .views(self => ({
    /**
     * Return the document group. Note: if there is no state saved about this document
     * group then undefined will be returned. Use getOrCreateDocumentGroup if you need to save
     * state.
     * @param docGroupId
     * @returns
     */
    getDocumentGroup(docGroupId: string) {
      return self.visitedDocumentGroups.get(docGroupId);
    },
  }))
  .views(self => ({
    /**
     * Note: If there hasn't been any state saved about the currentDocumentGroupId then
     * this will return undefined. Use getOrCreateDocumentGroup if you need to save
     * state.
     */
    get currentDocumentGroup() {
      if (!self.currentDocumentGroupId) return undefined;

      return self.getDocumentGroup(self.currentDocumentGroupId);
    },
    getPrimaryDocumentInDocumentGroup(docGroupId: string) {
      return self.visitedDocumentGroups.get(docGroupId)?.primaryDocumentKey;
    },
    getSecondaryDocumentInDocumentGroup(docGroupId: string) {
      return self.visitedDocumentGroups.get(docGroupId)?.secondaryDocumentKey;
    }
  }))
  .actions(self => ({
    /**
     * This should not be used from view. Because this is an action the properties it reads
     * will not be observed by that parent view. For example if the documentGroup is
     * deleted, that would not trigger the parent view to be re-rendered.
     * @param docGroupId
     * @returns
     */
    getOrCreateDocumentGroup(docGroupId: string) {
      let group = self.visitedDocumentGroups.get(docGroupId);
      if (!group) {
        group = UIDocumentGroup.create({id: docGroupId});
        self.visitedDocumentGroups.put(group);
      }
      return group;
    }
  }))
  .actions(self => ({
    /**
     * This will create or update the UIDocumentGroup in this tab.
     * This will not change the currentDocumentGroup.
     *
     * @param docGroupId
     * @param documentKey
     */
    setPrimaryDocumentInDocumentGroup(docGroupId: string, documentKey: string) {
      const group = self.getOrCreateDocumentGroup(docGroupId);
      group.setPrimaryDocumentKey(documentKey);
    },
    setSecondaryDocumentInDocumentGroup(docGroupId: string, documentKey: string) {
      const group = self.getOrCreateDocumentGroup(docGroupId);
      group.setSecondaryDocumentKey(documentKey);
    }
  }))
  .actions(self => ({
    openPrimaryDocumentInDocumentGroup(docGroupId: string, documentKey: string) {
      self.setPrimaryDocumentInDocumentGroup(docGroupId, documentKey);
      self.currentDocumentGroupId = docGroupId;
    },
  }));

interface UITabModel_V1 {
  id: string,
  openSubTab?: string,
  openDocuments: Record<string, string>,
  openSecondaryDocuments: Record<string, string>
}

export const PersistentUIModelV2 = types
  .model("PersistentUI", {
    dividerPosition: kDividerHalf,
    activeNavTab: types.maybe(types.string),
    docFilter: types.optional(DocFilterTypeEnum, "Problem"),
    primarySortBy: types.optional(types.string, "Group"),
    secondarySortBy: types.optional(types.string, "None"),
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
     * Set the open document in a sub tab. Do not actually open
     * the navTab or subTab.
     *
     * @param tab
     * @param subTab
     * @param documentKey
     */
    setOpenSubTabDocument(tab: string, subTab: string, documentKey: string) {
      const tabState = self.getOrCreateTabState(tab);
      tabState.setPrimaryDocumentInDocumentGroup(subTab, documentKey);
    },
    /**
     * Open to the tab and subTab and open a document.
     *
     * @param tab
     * @param subTab
     * @param documentKey
     */
    openSubTabDocument(tab: string, subTab: string, documentKey: string) {
      const tabState = self.getOrCreateTabState(tab);
      self.activeNavTab = tab;
      tabState.openPrimaryDocumentInDocumentGroup(subTab, documentKey);
    },
    openSubTabSecondaryDocument(tab: string, subTab: string, documentKey: string) {
      const tabState = self.getOrCreateTabState(tab);
      self.activeNavTab = tab;
      tabState.setSecondaryDocumentInDocumentGroup(subTab, documentKey);
      tabState.currentDocumentGroupId = subTab;
    },
    // Defaults to the current tab and document group
    closeDocumentGroupPrimaryDocument(
      tab: string|undefined=self.activeNavTab, documentGroupId: string|undefined=self.currentDocumentGroupId
    ) {
      if (tab && documentGroupId) {
        const tabState = self.getOrCreateTabState(tab);
        // We create the group if it doesn't exist, so we can save the state indicating the user
        // explicitly closed the document
        const group = tabState.getOrCreateDocumentGroup(documentGroupId);
        group.closePrimaryDocument();
      }
    },
    closeDocumentGroupSecondaryDocument(tab: string, documentGroupId: string) {
      const tabState = self.getOrCreateTabState(tab);
      const group = tabState.visitedDocumentGroups.get(documentGroupId);
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
  }))
  .actions(self => ({
    /**
     * Update the top level tab in the resources panel (left side), and guess a sub tab to open to view
     * this document. Currently this only works with non curriculum docs.
     *
     * @param doc a non curriculum document
     */
    openResourceDocument(doc: DocumentModelType, user?: UserModelType, sortedDocuments?: SortedDocuments) {
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
      if (navTab === ENavTab.kSortWork) {
        if (doc.type === ExemplarDocument) {
          const sortedDocumentGroups = sortedDocuments?.sortBy("Strategy");
          const openGroup = sortedDocumentGroups?.find(group => group.documents.some((d) => d.key === doc.key));
          subTab = JSON.stringify({primaryLabel: openGroup?.label, "primaryType": "Strategy"});
          self.setPrimarySortBy("Strategy");
          self.setSecondarySortBy("None");
        } else {
          const primarySortBy = self.primarySortBy as PrimarySortType;
          const sortedDocumentGroups = sortedDocuments?.sortBy(primarySortBy);
          const openGroup = sortedDocumentGroups?.find(group => group.documents.some((d) => d.key === doc.key));
          subTab = JSON.stringify({"primaryLabel": openGroup?.label, "primaryType": self.primarySortBy});
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
        applySnapshot(self, asObj);
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

export interface PersistenUIModelV2Snapshot extends SnapshotIn<typeof PersistentUIModelV2> {}

export const PersistentUIModel = types.snapshotProcessor(PersistentUIModelV2, {
  preProcessor(_snapshot) {
    const snapshot = _snapshot as unknown as PersistentUIModelV1Snapshot | PersistenUIModelV2Snapshot;
    if (snapshot.version === kPersistentUiStateVersion1) {
      const migrated = cloneDeep(snapshot) as unknown as PersistenUIModelV2Snapshot;
      migrated.version = kPersistentUiStateVersion2;
      const migratedTabs: NonNullable<PersistenUIModelV2Snapshot["tabs"]> = {};
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
