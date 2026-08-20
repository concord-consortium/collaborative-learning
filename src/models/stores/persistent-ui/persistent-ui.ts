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
import { ENavTab, kUnsupportedFixedStartTabs, NavTabModelType } from "../../view/nav-tabs";
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

// Returns the tab + divider to force, or undefined to fall through to the user's own restored state.
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
  if (kUnsupportedFixedStartTabs.includes(fixedStartTab)) {
    console.warn(`fixedStartView: "${fixedStartTab}" cannot be a fixed start tab; ignoring`);
    return undefined;
  }
  if (defaultPanelLayout === "workspace-only") {
    // The layout the author chose collapses the resources panel the start tab lives in, so forcing a
    // tab there shows nothing. Forcing the divider as well would close the panel on every load for a
    // returning user who had opened it, which is destructive rather than merely useless.
    console.warn(`fixedStartView: "workspace-only" collapses the resources panel; ignoring`);
    return undefined;
  }
  return { tab: fixedStartTab, dividerPosition: dividerForLayout(defaultPanelLayout) };
}

// The whole startup UI decision, extracted from the db hook so the seam is testable rather than being
// glue nobody can reach. Both steps always run: applyDefaultPanelLayout persists the unit's layout for
// a first-time visitor (it no-ops for everyone else), and the forced view is layered on top of it as a
// session-only override, so releasing the override leaves the user on the unit's layout rather than
// dropping them to the bare default.
export function applyStartupUIState(
  persistentUI: {
    applyDefaultPanelLayout: (layout: PanelLayout | undefined) => void;
    applyFixedStartView: (tab: string, dividerPosition: number) => void;
  },
  opts: { fixedStartView?: boolean; fixedStartTab?: string; defaultPanelLayout?: PanelLayout;
          hasDocumentTarget?: boolean },
  displayedTabs: string[]
) {
  persistentUI.applyDefaultPanelLayout(opts.defaultPanelLayout);
  const startView = resolveStartView(opts, displayedTabs);
  if (startView) {
    persistentUI.applyFixedStartView(startView.tab, startView.dividerPosition);
  }
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
    // The author's fixed start view, held as session-only overrides so the saved record is never
    // rewritten. While they are set the display prefers them: displayedActiveNavTab reports the tab,
    // displayedDividerPosition the divider, focusDocument reports nothing open for a document tab, and
    // that tab renders its thumbnail browser with no selection instead of the user's saved document.
    // The three parts are released independently, because no one user action implies the others:
    // navigating hands back the user's own tab, resizing hands back their own divider, and choosing a
    // sub tab hands back their own sub tab.
    startViewTab: undefined as string | undefined,
    startViewDividerPosition: undefined as number | undefined,
    // While set, the forced tab opens on its first sub tab rather than the one the user last used, so
    // "start on Class Work with every published thumbnail visible" actually lands on the thumbnails.
    // Only meaningful for the document tabs; the curriculum tabs always show a section, so there is no
    // "no document open" state to start in and their section is restored like the rest of the user's
    // state. See applyFixedStartView and docs/unit-configuration.md.
    startViewSubTabPinned: false
  }))
  .actions(self => ({
    // Navigating is the user taking over the tab, which takes the forced sub tab with it: pinning a
    // sub tab of a tab the user has left would apply the author's choice to a tab they chose. The
    // forced divider stands until they resize, or the panel would collapse under a user who had left
    // the resources pane closed.
    clearStartViewOverride() {
      self.startViewTab = undefined;
      self.startViewSubTabPinned = false;
    }
  }))
  .views((self) => ({
    get displayedDividerPosition () {
      return self.startViewDividerPosition ?? self.dividerPosition;
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
    // True while the author's forced start view is showing this tab; see startViewTab.
    isStartViewOverrideActiveFor(tab: string) {
      return self.startViewTab === tab;
    },
    // True while this tab should open on its first sub tab instead of the user's saved one.
    isStartViewSubTabPinnedFor(tab: string) {
      return self.startViewSubTabPinned && self.startViewTab === tab;
    },
    // The tab whose content is on screen: the forced start view's tab while it is active, else the
    // tab the user last chose. Note stores.displayedActiveNavTab additionally falls back to the first
    // displayed tab; this is the raw preference, for views that only need to know which tab is showing.
    get displayedNavTab () {
      return self.startViewTab ?? self.activeNavTab;
    }
  }))
  .views((self) => ({
    // The document group (sub tab, or curriculum section) of the tab that is actually on screen.
    // Watch this rather than currentDocumentGroupId, which is keyed off the user's own activeNavTab
    // and so reports a tab nobody can see while the author's fixed start view is active.
    get displayedCurrentDocumentGroupId () {
      const tab = self.displayedNavTab;
      return tab ? self.tabs.get(tab)?.currentDocumentGroupId : undefined;
    },
    // document key or section path for the resource (left) document, for the displayed tab
    get focusDocument () {
      const tab = self.displayedNavTab;
      if (tab === ENavTab.kProblems || tab === ENavTab.kTeacherGuide) {
        const facet = tab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.tabs.get(tab)?.currentDocumentGroupId, facet);
      } else if (tab && self.isStartViewOverrideActiveFor(tab)) {
        return undefined;
      } else {
        return self.activeTabModel?.currentDocumentGroup?.primaryDocumentKey;
      }
    },
    get focusSecondaryDocument () {
      const tab = self.displayedNavTab;
      if (tab === ENavTab.kProblems || tab === ENavTab.kTeacherGuide) {
        const facet = tab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.tabs.get(tab)?.currentDocumentGroupId, facet);
      } else if (tab && self.isStartViewOverrideActiveFor(tab)) {
        return undefined;
      } else {
        return self.activeTabModel?.currentDocumentGroup?.secondaryDocumentKey;
      }
    },
  }))
  .actions(self => ({
    setDividerPosition(position: number) {
      // Release the forced divider but keep showing the forced tab: resizing the pane, collapsing it,
      // or following the skip link is not navigation, and swapping the panel's content underneath a
      // resize would be a jump the user never asked for.
      self.startViewDividerPosition = undefined;
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
      self.clearStartViewOverride();
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
      self.clearStartViewOverride();
      const tabState = self.getOrCreateTabState(tab);
      self.activeNavTab = tab;
      tabState.openDocumentGroupPrimaryDocument(docGroupId, documentKey);
    },
    openDocumentGroupSecondaryDocument(tab: string, docGroupId: string, documentKey: string) {
      self.clearStartViewOverride();
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
    // Force the author-configured start view for this session. See startViewTab: this mutates nothing
    // persisted, so the user's saved place survives and returns as soon as they act on it.
    applyFixedStartView(tab: string, dividerPosition: number) {
      self.startViewTab = tab;
      self.startViewDividerPosition = dividerPosition;
      // The curriculum tabs always show a section rather than a browser, so there is no first sub tab
      // to start on; only the document tabs get their sub tab forced.
      self.startViewSubTabPinned = tab !== ENavTab.kProblems && tab !== ENavTab.kTeacherGuide;
    },
    /**
     * The user choosing a document group, as opposed to code initializing one. Releases the forced
     * sub tab first, so the click is not swallowed by the pin that put them on the first sub tab.
     * Use setCurrentDocumentGroupId for initialization, which must not release anything.
     *
     * @param tab
     * @param docGroupId
     */
    selectDocumentGroup(tab: string, docGroupId: string) {
      // Only the forced tab's own pin is released: a click in some other tab is not a choice about
      // where the forced tab starts.
      if (self.startViewTab === tab) self.startViewSubTabPinned = false;
      self.setCurrentDocumentGroupId(tab, docGroupId);
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
