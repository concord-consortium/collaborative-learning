import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { DocumentContentModel, DocumentContentModelType, cloneContentWithUniqueIds
      } from "../document/document-content";
import { ToolButtonModel } from "../tools/tool-button";
import { NavTabsConfigModel } from "./nav-tabs";
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

// Probably this should be changed to something more complex
export const ToolbarModel = types.array(ToolButtonModel);
export interface ToolbarModelType extends Instance<typeof ToolbarModel> {}
export type ToolbarModelSnapshot = SnapshotIn<typeof ToolbarModel>;

export const AppConfigModel = types
  .model("AppConfig", {
    // used in application loading message, log messages, etc.
    appName: "",
    // displayed in browser tab/window title
    pageTitle: "",
    // used for demo creator links
    demoProblemTitle: "",
    // the set of curriculum units available
    units: types.map(UnitSpecModel),
    // unit code overrides (legacy unit code support)
    unitCodeMap: types.map(types.string),
    // default problem to load if none specified
    defaultProblemOrdinal: "",
    // default unit to load if none specified
    defaultUnit: "",
    // disable grouping of students (e.g. Dataflow)
    autoAssignStudentsToIndividualGroups: false,
    // type of user document to create/show by default
    defaultDocumentType: types.optional(types.enumeration(["problem", "personal"]), "personal"),
    // default title of personal documents (problem documents don't have user-assigned titles)
    defaultDocumentTitle: "Untitled",
    // following two properties used for displaying titles for documents
    docTimeStampPropertyName: "",
    docDisplayIdPropertyName: "",
    // clients should use the defaultDocumentContent() method below
    defaultDocumentTemplate: types.maybe(DocumentContentModel),
    // default title of learning log documents
    defaultLearningLogTitle: "UntitledLog",
    // overrides `defaultLearningLogTitle`; not clear why both are required
    initialLearningLogTitle: "",
    // whether to create an initial/default learning log document for each user
    defaultLearningLogDocument: false,
    // whether to automatically divide problem documents into sections
    autoSectionProblemDocuments: false,
    // array of property names to use when constructing document labels
    documentLabelProperties: types.array(types.string),
    // terminology for referencing documents
    documentLabels: types.map(DocumentLabelModel),
    // disables publishing documents of particular types or with particular properties
    disablePublish: types.array(DocumentSpecModel),
    // configures naming of copied documents
    copyPreferOriginTitle: false,
    // enable/disable dragging of tiles
    disableTileDrags: false,
    // show the class switcher menu for teachers
    showClassSwitcher: false,
    // whether to show one-up/two-up view icons in document title bar
    supportStackedTwoUpView: false,
    // whether to show published (non-editable) documents in the editing workspace
    showPublishedDocsInPrimaryWorkspace: false,
    // comparison view placeholder content
    comparisonPlaceholderContent: types.optional(types.union(types.string, types.array(types.string)), ""),
    // configuration of navigation tabs (document navigation UI)
    navTabs: types.optional(NavTabsConfigModel, () => NavTabsConfigModel.create()),
    // configuration of document toolbar
    toolbar: ToolbarModel,
    // configurable settings that can be overridden at problem, investigation, unit, or app-config levels
    // currently used for default number format but designed to be extended
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
    }
  }))
  .views(self => ({
    getUnitBasePath(unitId: string) {
      const unitSpec = self.getUnit(unitId);
      if (!unitSpec) return "";
      const parts = unitSpec.content.split("/");
      if (parts.length > 0) {
        parts.splice(parts.length - 1, 1);
      }
      return parts.join("/");
    }
  }));
export type AppConfigModelType = Instance<typeof AppConfigModel>;
export type AppConfigSpec = SnapshotIn<typeof AppConfigModel>;
