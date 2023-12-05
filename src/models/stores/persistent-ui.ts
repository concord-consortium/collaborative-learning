import { getSnapshot, onSnapshot, applySnapshot, types } from "mobx-state-tree";
import { AppConfigModelType } from "./app-config-model";
import { kDividerHalf, kDividerMax, kDividerMin } from "./ui-types";
import { WorkspaceModel } from "./workspace";
import { DocumentModelType } from "../document/document";
import { ENavTab } from "../view/nav-tabs";
import { buildSectionPath, getCurriculumMetadata } from "../../../functions/src/shared";
import { LearningLogDocument, LearningLogPublication, PersonalDocument,
  PersonalPublication, PlanningDocument, ProblemDocument,
  ProblemPublication, SupportPublication } from "../document/document-types";
import { UserModelType } from "./user";
import { DB } from "../../lib/db";
import { safeJsonParse } from "../../utilities/js-utils";

export const kPersistentUiStateVersion = "1.0.0";
export const kSparrowAnnotationMode = "sparrow";

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
    activeNavTab: ENavTab.kProblems,
    showAnnotations: true,
    showTeacherContent: true,
    showChatPanel: false,
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
    },
    async initializePersistentUISync(user: UserModelType, db: DB){
      // TASKS
      // use one path, which will allow you to use .set instead of .update
      // (we may still need two refs because we don't know if they get out of date? but probably just fine to have one)
      // move the computation of the persistentUI path into db.ts where getOfferingUserPath is defined (make a sibling)
      // it will be getPersistentUIPath
      const userPath = db.firebase.getOfferingUserPath(user);
      const uiPath = userPath + "/persistentUI";
      const getRef = db.firebase.ref(uiPath);
      const theData: string | undefined = ( await getRef.once("value"))?.val();
      const asObj = safeJsonParse(theData);
      if (asObj) applySnapshot(self, asObj);

      onSnapshot(self, (snapshot)=>{
        const snapshotStr = JSON.stringify(snapshot);
        const updateRef = db.firebase.ref(userPath);
        updateRef.update({persistentUI: snapshotStr});
        // TODO (future PR)
        // an additional write of the value of `workspaceDocument` to the group
        // so it is in a place where groupmates' clients can easily listen to it
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

