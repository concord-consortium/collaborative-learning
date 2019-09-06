import { types, SnapshotIn, Instance } from "mobx-state-tree";

export enum ERightNavTab {
  kMyWork = "my-work",
  kClassWork = "class-work"
}

// generic type which maps tab id to values of another type
export type RightNavTabMap<T> = {
  [K in ERightNavTab]: T;
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
  kStarredLearingLogs = "starred-learning-logs"
}

export const NavTabSectionModel =
  types.model("NavTabSectionModel", {
    className: "",
    title: types.string,
    type: types.enumeration<ENavTabSectionType>("ENavTabSectionType", Object.values(ENavTabSectionType)),
    dataTestHeader: "section-header",
    dataTestItem: "section-item",
    documentTypes: types.array(types.string),
    properties: types.array(types.string),
    showStars: false,
    addDocument: false
  });
export type NavTabSectionSpec = SnapshotIn<typeof NavTabSectionModel>;
export type NavTabSectionModelType = Instance<typeof NavTabSectionModel>;

export const RightNavTabModel =
  types.model("RightNavTab", {
    tab: types.enumeration<ERightNavTab>("ERightNavTab", Object.values(ERightNavTab)),
    label: types.string,
    hideGhostUser: false,
    sections: types.array(NavTabSectionModel)
  });
export type RightNavTabSpec = SnapshotIn<typeof RightNavTabModel>;
export type RightNavTabModelType = Instance<typeof RightNavTabModel>;

export function navTabSectionId(section: NavTabSectionSpec) {
  const title = section.title.toLowerCase().replace(" ", "-");
  return `${section.type}-${title}`;
}
