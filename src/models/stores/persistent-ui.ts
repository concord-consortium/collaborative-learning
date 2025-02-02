import { getSnapshot, applySnapshot, types,
  onSnapshot
} from "mobx-state-tree";
import { AppConfigModelType } from "./app-config-model";
import { DocFilterType, DocFilterTypeEnum, kDividerHalf, kDividerMax,
         kDividerMin,
         PrimarySortType} from "./ui-types";
import { isWorkspaceModelSnapshot, WorkspaceModel } from "./workspace";
import { DocumentModelType } from "../document/document";
import { ENavTab } from "../view/nav-tabs";
import { buildSectionPath, getCurriculumMetadata } from "../../../shared/shared";
import { ExemplarDocument, LearningLogDocument, LearningLogPublication, PersonalDocument,
  PersonalPublication, PlanningDocument, ProblemDocument,
  ProblemPublication, SupportPublication } from "../document/document-types";
import { UserModelType } from "./user";
import { DB } from "../../lib/db";
import { safeJsonParse } from "../../utilities/js-utils";
import { urlParams } from "../../utilities/url-params";
import { removeLoadingMessage, showLoadingMessage } from "../../utilities/loading-utils";
import { SortedDocuments } from "./sorted-documents";

export const kPersistentUiStateVersion = "1.0.0";

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
    version: types.optional(types.literal(kPersistentUiStateVersion), kPersistentUiStateVersion),
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
    get openSubTab () {
      return self.activeNavTab && self.tabs.get(self.activeNavTab)?.openSubTab;
    },
  }))
  .views((self) => ({
    // document key or section path for resource (left) document
    get focusDocument () {
      if (self.activeNavTab === ENavTab.kProblems || self.activeNavTab === ENavTab.kTeacherGuide) {
        const facet = self.activeNavTab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.openSubTab, facet);
      } else {
        if (self.activeNavTab && self.openSubTab) {
          const activeTabState = self.tabs.get(self.activeNavTab);
          return activeTabState?.openDocuments.get(self.openSubTab);
        } else {
          return undefined;
        }
      }
    },
    get focusSecondaryDocument () {
      if (self.activeNavTab === ENavTab.kProblems || self.activeNavTab === ENavTab.kTeacherGuide) {
        const facet = self.activeNavTab === ENavTab.kTeacherGuide ? ENavTab.kTeacherGuide : undefined;
        return buildSectionPath(self.problemPath, self.openSubTab, facet);
      } else {
        if (self.activeNavTab && self.openSubTab) {
          const activeTabState = self.tabs.get(self.activeNavTab);
          return activeTabState?.openSecondaryDocuments.get(self.openSubTab);
        } else {
          return undefined;
        }
      }
    },
  }))
  .actions((self) => {

    const getTabState = (tab: string) => {
      let tabState = self.tabs.get(tab);
      if (!tabState) {
        tabState = UITabModel.create({id: tab});
        self.tabs.put(tabState);
      }
      return tabState;
    };
    return {
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
      // Defaults to the current tab and subtab
      closeSubTabDocument(tab: string|undefined=self.activeNavTab, subTab: string|undefined=self.openSubTab) {
        if (tab && subTab) {
          const tabState = getTabState(tab);
          tabState.openDocuments.delete(subTab);
        }
      },
      closeSubTabSecondaryDocument(tab: string, subTab: string) {
        const tabState = getTabState(tab);
        tabState.openSecondaryDocuments.delete(subTab);
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
    };
  })
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
      self.setOpenSubTab(navTab, subTab);
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

export type PersistentUIModelType = typeof PersistentUIModel.Type;


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
