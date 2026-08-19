import {
  getSnapshot, applySnapshot, types, onSnapshot, SnapshotIn, Instance
} from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { buildSectionPath, getCurriculumMetadata } from "../../../../shared/shared";
import { DB } from "../../../lib/db";
import { safeJsonParse } from "../../../utilities/js-utils";
import { removeLoadingMessage, showLoadingMessage } from "../../../utilities/loading-utils";
import { isValidSortTypeId } from "../../../utilities/sort-utils";
import { urlParams } from "../../../utilities/url-params";
import { DocumentModelType } from "../../document/document";
import {
  ExemplarDocument, LearningLogDocument, LearningLogPublication, PersonalDocument, PersonalPublication,
  PlanningDocument, ProblemDocument, ProblemPublication, SupportPublication
} from "../../document/document-types";
import { ENavTab, NavTabModelType } from "../../view/nav-tabs";
import { AppConfigModelType } from "../app-config-model";
import { PanelLayout } from "../problem-configuration";
import { SortedDocuments } from "../sorted-documents";
import {
  DocFilterType, DocFilterTypeEnum, kDividerHalf, kDividerMax, kDividerMin, PrimarySortType
} from "../ui-types";
import { UserModelType } from "../user";
import { isWorkspaceModelSnapshot, WorkspaceModel } from "../workspace";
import { UITabModel, UITabModel_V1 } from "./ui-tab-model";

export const kPersistentUiStateVersion2 = "2.0.0";
export const kPersistentUiStateVersion1 = "1.0.0";

// The divider position a given defaultPanelLayout implies, so fixedStartView and defaultPanelLayout agree.
export function dividerForLayout(layout: PanelLayout | undefined) {
  switch (layout) {
    case "workspace-only": return kDividerMin;
    case "resources-only": return kDividerMax;
    default: return kDividerHalf; // "split" or undefined
  }
}

// Decides whether to force the author start view. Returns the tab + divider to force, or undefined to
// fall through to normal restore (switch off, no tab, tab not displayed, or an explicit deep link).
export function resolveStartView(
  opts: { fixedStartView?: boolean; fixedStartTab?: string; defaultPanelLayout?: PanelLayout;
          hasDocumentTarget?: boolean },
  displayedTabs: string[]
): { tab: string; dividerPosition: number } | undefined {
  const { fixedStartView, fixedStartTab, defaultPanelLayout, hasDocumentTarget } = opts;
  if (!fixedStartView || !fixedStartTab) return undefined;
  // An explicit document link (e.g. ?studentDocument=...) should win over the forced view.
  if (hasDocumentTarget) return undefined;
  if (!displayedTabs.includes(fixedStartTab)) {
    console.warn(`fixedStartView: "${fixedStartTab}" is not a displayed tab; ignoring`);
    return undefined;
  }
  return { tab: fixedStartTab, dividerPosition: dividerForLayout(defaultPanelLayout) };
}

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
    showHistoryView: false,
    showRemoteHistoryView: false,
    tabs: types.map(UITabModel),
    problemWorkspace: WorkspaceModel,
    teacherPanelKey: types.maybe(types.string),
    version: types.optional(types.literal(kPersistentUiStateVersion2), kPersistentUiStateVersion2),
  })
  .volatile(self => ({
    defaultLeftNavExpanded: false,
    problemPath: "",
    isDocumentsView: false,
    hasSavedPersistentUI: false,
    // Author's fixed start view, applied as a session-only override so it never overwrites the saved
    // record. When set, the display prefers it (tab, divider, and a no-document browser view for the
    // tab); it is cleared the moment the user navigates. undefined = restore the user's own state.
    startViewOverride: undefined as { tab: string, dividerPosition: number } | undefined
  }))
  .views((self) => ({
    // The divider the UI should render: the forced-start override when active, else the saved position.
    get displayedDividerPosition () {
      return self.startViewOverride?.dividerPosition ?? self.dividerPosition;
    }
  }))
  .views((self) => ({
    get navTabContentShown () {
      return self.displayedDividerPosition > kDividerMin;
    },
    get workspaceShown () {
      return self.displayedDividerPosition < kDividerMax;
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
      self.startViewOverride = undefined; // moving the divider is a user action; drop the forced view
      self.dividerPosition = position;
    },
    setHasSavedPersistentUI(value: boolean) {
      self.hasSavedPersistentUI = value;
    },
    applyDefaultPanelLayout(layout: PanelLayout | undefined) {
      if (self.hasSavedPersistentUI) return;
      // Delegate to the shared mapping, but keep the "leave the divider alone for split/undefined"
      // behavior (an unconditional assignment would be a behavior change for first-time visitors).
      if (layout === "workspace-only" || layout === "resources-only") {
        self.dividerPosition = dividerForLayout(layout);
      }
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
    setIsDocumentsView(show: boolean) {
      self.isDocumentsView = show;
    },
    toggleShowDocumentScroller(show: boolean) {
      self.showDocumentScroller = show;
    },
    toggleHistoryView() {
      self.showHistoryView = !self.showHistoryView;
    },
    setShowHistoryView(show: boolean) {
      self.showHistoryView = show;
    },
    toggleRemoteHistoryView() {
      self.showRemoteHistoryView = !self.showRemoteHistoryView;
    },
    setShowRemoteHistoryView(show: boolean) {
      self.showRemoteHistoryView = show;
    },
    setActiveNavTab(tab: string) {
      self.startViewOverride = undefined; // choosing a tab is a user action; drop the forced view
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
      self.startViewOverride = undefined; // opening a document is a user action; drop the forced view
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
    // Force the author-configured start view for this session WITHOUT mutating the persisted record:
    // it is a volatile override that the display consults (displayedActiveNavTab, displayedDividerPosition,
    // and a no-document browser view for the tab via section-document-or-browser). Because it never
    // touches activeNavTab/dividerPosition/document groups, the user's saved state survives, and any
    // navigation action (setActiveNavTab/setDividerPosition/openDocumentGroupPrimaryDocument) clears it.
    applyFixedStartView(tab: string, dividerPosition: number) {
      self.startViewOverride = { tab, dividerPosition };
    },
    clearStartViewOverride() {
      self.startViewOverride = undefined;
    },
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
      opts?: { fromUrlStudentDocument?: boolean, hasStudentWorkGroup?: boolean }
    ) {
      const { aiEvaluation, navTabs } = appConfig || {};
      // Only route to tabs that are actually displayed. A unit can hide a tab it
      // defines (e.g. mods hides student-work and exposes sort-work as "Class Work");
      // routing the active tab to a hidden tab leaves displayedActiveNavTab falling
      // back to the first tab, so the document never appears.
      const availableTabs = navTabs?.tabSpecs.filter(tab => !tab.hidden).map(tab => tab.tab) ?? [];
      let navTab = "";

      if (opts?.fromUrlStudentDocument) {
        // Student Work is group-keyed and loads its group's documents asynchronously,
        // so activating it without the doc's group available leaves a blank panel.
        // Use it only when the viewer's group is available; otherwise fall back to
        // Sort Work, which needs no group.
        if (opts.hasStudentWorkGroup && availableTabs.includes(ENavTab.kStudentWork)) {
          navTab = ENavTab.kStudentWork;
        } else if (availableTabs.includes(ENavTab.kSortWork)) {
          navTab = ENavTab.kSortWork;
        }
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

      // getNavTabOfDocument can pick a tab the unit hides (e.g. a teacher/researcher
      // opening another student's problem doc resolves to student-work, which mods
      // hides). Routing there leaves displayedActiveNavTab falling back to the first
      // tab, so substitute the always-visible Sort Work tab when it's available.
      if (navTab && !availableTabs.includes(navTab as ENavTab) && availableTabs.includes(ENavTab.kSortWork)) {
        navTab = ENavTab.kSortWork;
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
        const groupId = doc.groupIdOfUserOwner;
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
            if (aiEvaluation || opts?.fromUrlStudentDocument) {
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
      self.setHasSavedPersistentUI(!!asObj);
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
