import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel } from "../document/document-content";
import { ToolButtonModel } from "../tools/tool-types";
import { RightNavTabModel } from "../view/right-nav";

export const AppConfigModel = types
  .model("User", {
    appName: "",
    pageTitle: "",
    demoProblemTitle: "",
    units: types.map(types.string),
    defaultUnit: "",
    defaultDocumentType: types.optional(types.enumeration(["problem", "personal"]), "personal"),
    defaultDocumentTitle: "Untitled",
    defaultDocumentContent: types.maybe(DocumentContentModel),
    defaultLearningLogTitle: "UntitledLog",
    rightNavTabs: types.array(RightNavTabModel),
    toolbar: types.array(ToolButtonModel)
  });
export type AppConfigModelType = Instance<typeof AppConfigModel>;
export type AppConfigSpec = SnapshotIn<typeof AppConfigModel>;
