import { types, SnapshotIn, Instance } from "mobx-state-tree";
import { UserModelType, UserTypeEnum } from "../stores/user";

export enum EContentTab {
  kProblems = "problems",
  kStudentWork = "student-work",
  kMyWork = "my-work",
  kClassWork = "class-work",
  kLearningLog = "learning-log",
  kSupports = "supports"
}

// generic type which maps tab id to values of another type
export type ContentTabMap<T> = {
  [K in EContentTab]: T;
};

export enum EContentTabSectionType {
  kPersonalDocuments = "personal-documents",
  kProblemDocuments = "problem-documents",
  kLearningLogs = "learning-logs",
  kPublishedPersonalDocuments = "published-personal-documents",
  kPublishedProblemDocuments = "published-problem-documents",
  kPublishedLearningLogs = "published-learning-logs",
  kStarredPersonalDocuments = "starred-personal-documents",
  kStarredProblemDocuments = "starred-problem-documents",
  kStarredLearingLogs = "starred-learning-logs",
  kCurricularSupports = "curricular-supports",
  kTeacherSupports = "teacher-supports"
}

export enum EContentTabOrder {
  kOriginal = "original",
  kReverse = "reverse"
}
const ENavTabOrderMSTType =
        types.enumeration<EContentTabOrder>("ENavTabOrder", Object.values(EContentTabOrder));

export const ContentTabSectionModel =
  types.model("NavTabSectionModel", {
    className: "",
    title: types.string,
    type: types.enumeration<EContentTabSectionType>("ENavTabSectionType", Object.values(EContentTabSectionType)),
    dataTestHeader: "section-header",
    dataTestItem: "section-item",
    documentTypes: types.array(types.string),
    order: types.optional(ENavTabOrderMSTType, EContentTabOrder.kReverse),
    properties: types.array(types.string),
    showStars: types.array(UserTypeEnum),
    showGroupWorkspaces: false,
    addDocument: false
  })
  .views(self => ({
    showStarsForUser(user: UserModelType) {
      return user.type && (self.showStars.indexOf(user.type) !== -1);
    },
    showDeleteForUser(user: UserModelType) {
      // allow teachers to delete supports
      return (user.type === "teacher") && (self.type === EContentTabSectionType.kTeacherSupports);
    },
  }));
export type ContentTabSectionSpec = SnapshotIn<typeof ContentTabSectionModel>;
export type ContentTabSectionModelType = Instance<typeof ContentTabSectionModel>;

export const ContentTabModel =
  types.model("ContentTab", {
    tab: types.enumeration<EContentTab>("EContentTab", Object.values(EContentTab)),
    label: types.string,
    teacherOnly: false,
    sections: types.array(ContentTabSectionModel)
  });
export type ContentTabSpec = SnapshotIn<typeof ContentTabModel>;
export type ContentTabModelType = Instance<typeof ContentTabModel>;

export function contentTabSectionId(section: ContentTabSectionSpec) {
  const title = section.title.toLowerCase().replace(" ", "-");
  return `${section.type}-${title}`;
}
