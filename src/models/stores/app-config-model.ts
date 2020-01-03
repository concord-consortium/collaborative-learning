import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType, cloneContentWithUniqueIds
      } from "../document/document-content";
import { ToolButtonModel } from "../tools/tool-types";
import { RightNavTabModel } from "../view/right-nav";

const DocumentSpecModel = types
  .model("DocumentSpec", {
    documentType: types.string,
    properties: types.array(types.string)
  });

const RightNavAppConfigModel = types
  .model("RightNavAppConfig", {
    defaultExpanded: false,
    preventExpandCollapse: false,
    lazyLoadTabContents: false,
    tabSpecs: types.array(RightNavTabModel)
  });

const DocumentLabelModel = types
  .model("DocumentLabel", {
    labels: types.map(types.string)
  })
  .views(self => ({
    getUpperLabel(num?: number) {
      const numLabel = num != null ? self.labels.get(String(num)) : "";
      return numLabel || self.labels.get("n") || "";
    }
  }))
  .views(self => ({
    getLowerLabel(num?: number) {
      return self.getUpperLabel(num).toLowerCase();
    }
  }))
  .views(self => ({
    getLabel(num?: number, lowerCase?: boolean) {
      return lowerCase
              ? self.getLowerLabel(num)
              : self.getUpperLabel(num);
    }
  }));
export const AppConfigModel = types
  .model("AppConfig", {
    appName: "",
    pageTitle: "",
    demoProblemTitle: "",
    units: types.map(types.string),
    defaultProblemOrdinal: "",
    defaultUnit: "",
    autoAssignStudentsToIndividualGroups: false,
    defaultDocumentType: types.optional(types.enumeration(["problem", "personal"]), "personal"),
    defaultDocumentTitle: "Untitled",
    docTimeStampPropertyName: "",
    // clients should use the defaultDocumentContent() method below
    defaultDocumentTemplate: types.maybe(DocumentContentModel),
    defaultLearningLogTitle: "UntitledLog",
    initialLearningLogTitle: "",
    defaultLearningLogDocument: false,
    autoSectionProblemDocuments: false,
    documentLabelProperties: types.array(types.string),
    documentLabels: types.map(DocumentLabelModel),
    disablePublish: types.array(DocumentSpecModel),
    copyPreferOriginTitle: false,
    disableTileDrags: false,
    showClassSwitcher: false,
    supportStackedTwoUpView: false,
    showPublishedDocsInPrimaryWorkspace: false,
    comparisonPlaceholderContent: types.optional(types.union(types.string, types.array(types.string)), ""),
    rightNav: types.optional(RightNavAppConfigModel, () => RightNavAppConfigModel.create()),
    toolbar: types.array(ToolButtonModel)
  })
  .views(self => ({
    get defaultDocumentContent(): DocumentContentModelType | undefined {
      return cloneContentWithUniqueIds(self.defaultDocumentTemplate);
    },
    getDocumentLabel(docType: string, num?: number, lowerCase?: boolean) {
      const docLabel = self.documentLabels.get(docType);
      return docLabel && docLabel.getLabel(num, lowerCase) || "";
    }
  }));
export type AppConfigModelType = Instance<typeof AppConfigModel>;
export type AppConfigSpec = SnapshotIn<typeof AppConfigModel>;
