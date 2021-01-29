import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType, cloneContentWithUniqueIds
      } from "../document/document-content";
import { ToolButtonModel } from "../tools/tool-types";
import { ENavTab, NavTabModel, NavTabSpec } from "../view/nav-tabs";
import { SettingsMstType } from "./settings";

const UnitSpecModel = types
  .model("UnitSpec", {
    content: types.string,
    guide: ""
  });

const DocumentSpecModel = types
  .model("DocumentSpec", {
    documentType: types.string,
    properties: types.array(types.string)
  });

const NavTabsAppConfigModel = types
  .model("NavTabsAppConfig", {
    defaultExpanded: false,
    preventExpandCollapse: false,
    lazyLoadTabContents: false,
    tabSpecs: types.array(NavTabModel)
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
    units: types.map(UnitSpecModel),
    unitCodeMap: types.map(types.string),
    defaultProblemOrdinal: "",
    defaultUnit: "",
    autoAssignStudentsToIndividualGroups: false,
    defaultDocumentType: types.optional(types.enumeration(["problem", "personal"]), "personal"),
    defaultDocumentTitle: "Untitled",
    docTimeStampPropertyName: "",
    docDisplayIdPropertyName: "",
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
    navTabs: types.optional(NavTabsAppConfigModel, () => NavTabsAppConfigModel.create()),
    toolbar: types.array(ToolButtonModel),
    settings: types.maybe(SettingsMstType)
  })
  .views(self => ({
    getUnit(unitId: string) {
      const unitCode = self.unitCodeMap.get(unitId) || unitId;
      return self.units.get(unitCode);
    },
    get defaultDocumentContent(): DocumentContentModelType | undefined {
      return cloneContentWithUniqueIds(self.defaultDocumentTemplate);
    },
    getDocumentLabel(docType: string, num?: number, lowerCase?: boolean) {
      const docLabel = self.documentLabels.get(docType);
      return docLabel && docLabel.getLabel(num, lowerCase) || "";
    },
    getNavTabSpec(tabId: ENavTab): NavTabSpec | undefined {
      return self.navTabs.tabSpecs.find(tab => tabId === tab.tab);
    }
  }));
export type AppConfigModelType = Instance<typeof AppConfigModel>;
export type AppConfigSpec = SnapshotIn<typeof AppConfigModel>;
