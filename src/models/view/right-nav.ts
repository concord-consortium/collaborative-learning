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

export const RightNavTabModel =
  types.model("RightNavTab", {
    tab: types.enumeration<ERightNavTab>("ERightNavTab", Object.values(ERightNavTab)),
    label: types.string,
    hideGhostUser: false
  });
export type RightNavTabSpec = SnapshotIn<typeof RightNavTabModel>;
