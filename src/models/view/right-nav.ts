import { types, SnapshotIn } from "mobx-state-tree";

export enum ERightNavTab {
  kMyWork = "my-work",
  kClassWork = "class-work",
  kClassLogs = "class-logs"
}

// generic type which maps tab id to values of another type
export type RightNavTabMap<T> = {
  [K in ERightNavTab]: T;
};

export enum ENavTabSectionType {
  kPersonalDocuments = "personal-documents",
  kProblemDocuments = "problem-documents",
  kLearningLogs = "learning-logs",
  kPublishedDocuments = "published-documents",
  kStarredDocuments = "starred-documents"
}

const NavTabSectionModel =
  types.model("NavTabSectionModel", {
    title: types.string,
    type: types.enumeration<ENavTabSectionType>("ENavTabSectionType", Object.values(ENavTabSectionType))
  });
export type NavTabSectionSpec = SnapshotIn<typeof NavTabSectionModel>;

export const RightNavTabModel =
  types.model("RightNavTab", {
    tab: types.enumeration<ERightNavTab>("ERightNavTab", Object.values(ERightNavTab)),
    label: types.string,
    hideGhostUser: false,
    sections: types.array(NavTabSectionModel)
  });
export type RightNavTabSpec = SnapshotIn<typeof RightNavTabModel>;
