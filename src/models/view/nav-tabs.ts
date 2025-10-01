import { types, SnapshotIn, Instance } from "mobx-state-tree";
import { UserModelType } from "../stores/user";
import { UserTypeEnum } from "../stores/user-types";

export enum ENavTab {
  kProblems = "problems",
  kTeacherGuide = "teacher-guide",
  kStudentWork = "student-work",
  kMyWork = "my-work",
  kClassWork = "class-work",
  kSortWork = "sort-work",
  kLearningLog = "learning-log",
  kSupports = "supports"
}

// these are the tabs used in the current unit configurations
export enum EAuthorableNavTab {
  kProblems = "problems",
  kTeacherGuide = "teacher-guide",
  kStudentWork = "student-work",
  kMyWork = "my-work",
  kClassWork = "class-work",
  kSortWork = "sort-work",
}

export const kBookmarksTabTitle = "Bookmarks";

// generic type which maps tab id to values of another type
export type NavTabMap<T> = {
  [K in ENavTab]: T;
};

export enum ENavTabSectionType {
  kPersonalDocuments = "personal-documents",
  kProblemDocuments = "problem-documents",
  kLearningLogs = "learning-logs",
  kPublishedPersonalDocuments = "published-personal-documents",
  kPublishedProblemDocuments = "published-problem-documents",
  kPublishedLearningLogs = "published-learning-logs",
  kStarredPersonalDocuments = "starred-personal-documents",
  kStarredProblemDocuments = "starred-problem-documents",
  kStarredLearningLogs = "starred-learning-logs",
  kCurricularSupports = "curricular-supports",
  kTeacherSupports = "teacher-supports"
}

export enum ENavTabOrder {
  kOriginal = "original",
  kReverse = "reverse"
}
const ENavTabOrderMSTType =
        types.enumeration<ENavTabOrder>("ENavTabOrder", Object.values(ENavTabOrder));

export const NavTabSectionModel =
  types.model("NavTabSectionModel", {
    className: "",
    title: types.string,
    type: types.enumeration<ENavTabSectionType>("ENavTabSectionType", Object.values(ENavTabSectionType)),
    dataTestHeader: "section-header",
    dataTestItem: "section-item",
    documentTypes: types.array(types.string),
    order: types.optional(ENavTabOrderMSTType, ENavTabOrder.kReverse),
    properties: types.array(types.string),
    showStars: types.array(UserTypeEnum),
    showGroupWorkspaces: false,
    addDocument: false,
    openFirstDocumentAutomatically: types.maybe(types.boolean)
  })
  .views(self => ({
    showStarsForUser(user: UserModelType) {
      return user.type && (self.showStars.indexOf(user.type) !== -1);
    },
    get allowDelete(){
      const deletableTypes = [ENavTabSectionType.kPublishedPersonalDocuments,
        ENavTabSectionType.kPublishedProblemDocuments,
        ENavTabSectionType.kPublishedLearningLogs,
        ENavTabSectionType.kTeacherSupports,
       ];
      return deletableTypes.includes(self.type);
    }
  }));
export type NavTabSectionSpec = SnapshotIn<typeof NavTabSectionModel>;
export type NavTabSectionModelType  = Instance<typeof NavTabSectionModel>;

export interface ISubTabModel {
  label: string;
  sections: NavTabSectionModelType[];
}

export const NavTabModel =
  types.model("NavTab", {
    tab: types.enumeration<ENavTab>("ENavTab", Object.values(ENavTab)),
    label: types.string,
    teacherOnly: false,
    sections: types.array(NavTabSectionModel),
    hidden: types.optional(types.boolean, false)
  })
  .views(self => ({
    // combine sections with matching titles into a single tab with sub-sections
    get subTabs() {
      const _subTabs: ISubTabModel[] = [];
      self.sections?.forEach(section => {
        const found = _subTabs.find(tab => tab.label === section.title);
        if (found) {
          found.sections.push(section);
        }
        else {
          _subTabs.push({ label: section.title, sections: [section] });
        }
      });
      return _subTabs;
    }
  }));
export type NavTabSpec = SnapshotIn<typeof NavTabModel>;
export type NavTabModelType = Instance<typeof NavTabModel>;

export function navTabSectionId(section: NavTabSectionSpec) {
  const title = section.title.toLowerCase().replace(" ", "-");
  return `${section.type}-${title}`;
}
