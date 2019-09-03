import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { ToolButtonModel } from "../tools/tool-types";
import { RightNavTabModel } from "../view/right-nav";

export const AppConfigModel = types
  .model("User", {
    pageTitle: "",
    demoProblemTitle: "",
    units: types.map(types.string),
    defaultUnit: "",
    defaultDocumentType: types.optional(types.enumeration(["problem", "personal"]), "personal"),
    rightNavTabs: types.array(RightNavTabModel),
    toolbar: types.array(ToolButtonModel)
  });
export type AppConfigModelType = Instance<typeof AppConfigModel>;
export type AppConfigSpec = SnapshotIn<typeof AppConfigModel>;
