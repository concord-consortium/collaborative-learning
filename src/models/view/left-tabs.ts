import { types, SnapshotIn, Instance } from "mobx-state-tree";
import { UserModelType, UserTypeEnum } from "../stores/user";

export enum ELeftTab {
  kProblems = "problems",
  kStudentWork = "student-work",
  kMyWork = "my-work",
  kClassWork = "class-work",
  kLearningLog = "learning-log",
  kSupports = "supports"
}

// generic type which maps tab id to values of another type
export type LeftTabMap<T> = {
  [K in ELeftTab]: T;
};

export enum ELeftTabSectionType {
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

export enum ELeftTabOrder {
  kOriginal = "original",
  kReverse = "reverse"
}
const ENavTabOrderMSTType =
        types.enumeration<ELeftTabOrder>("ENavTabOrder", Object.values(ELeftTabOrder));

export const LeftTabSectionModel =
  types.model("NavTabSectionModel", {
    className: "",
    title: types.string,
    type: types.enumeration<ELeftTabSectionType>("ENavTabSectionType", Object.values(ELeftTabSectionType)),
    dataTestHeader: "section-header",
    dataTestItem: "section-item",
    documentTypes: types.array(types.string),
    order: types.optional(ENavTabOrderMSTType, ELeftTabOrder.kReverse),
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
      return (user.type === "teacher") && (self.type === ELeftTabSectionType.kTeacherSupports);
    },
  }));
export type LeftTabSectionSpec = SnapshotIn<typeof LeftTabSectionModel>;
export type LeftTabSectionModelType = Instance<typeof LeftTabSectionModel>;

export const LeftTabModel =
  types.model("LeftTab", {
    tab: types.enumeration<ELeftTab>("ELeftTab", Object.values(ELeftTab)),
    label: types.string,
    hideGhostUser: false,
    teacherOnly: false,
    sections: types.array(LeftTabSectionModel)
  });
export type LeftTabSpec = SnapshotIn<typeof LeftTabModel>;
export type LeftTabModelType = Instance<typeof LeftTabModel>;

export function leftTabSectionId(section: LeftTabSectionSpec) {
  const title = section.title.toLowerCase().replace(" ", "-");
  return `${section.type}-${title}`;
}
