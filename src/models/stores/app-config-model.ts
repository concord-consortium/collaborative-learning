import { types, Instance, SnapshotIn } from "mobx-state-tree";
import { SectionModelType } from "../curriculum/section";
import { DocumentContentModel, DocumentContentModelType } from "../document/document-content";
import { ConfigurationManager, mergeDisabledFeatures } from "./configuration-manager";
import { NavTabsConfigModel } from "./nav-tabs";
import { ToolbarModel } from "./problem-configuration";
import { SettingsGroupMstType } from "./settings";
import { DocumentLabelModel, UnitConfiguration } from "./unit-configuration";

export const UnitSpecModel = types
  .model("UnitSpec", {
    content: types.string,
    guide: ""
  });

export const AppConfigModel = types
  .model("AppConfig", {
    // the set of curriculum units available
    units: types.map(UnitSpecModel),
    // unit code overrides (legacy unit code support)
    unitCodeMap: types.map(types.string),
    // default problem to load if none specified
    defaultUnit: "",
    // default unit configuration
    config: types.frozen<UnitConfiguration>()
  })
  .volatile(self => ({
    configMgr: new ConfigurationManager(self.config, []),
    navTabs: NavTabsConfigModel.create(self.config?.navTabs || {}),
    disabledFeatures: self.config?.disabledFeatures || [],
    toolbar: ToolbarModel.create(self.config?.toolbar || []),
    settings: self.config?.settings
  }))
  .actions(self => ({
    setConfigs(configs: Partial<UnitConfiguration>[]) {
      self.configMgr = new ConfigurationManager(self.config, configs);
      self.navTabs = NavTabsConfigModel.create(self.configMgr.navTabs);
      self.disabledFeatures = self.configMgr.disabledFeatures;
      self.toolbar = ToolbarModel.create(self.configMgr.toolbar);
      self.settings = self.configMgr.settings;
    }
  }))
  .views(self => ({
    getUnit(unitId: string) {
      const unitCode = self.unitCodeMap.get(unitId) || unitId;
      return self.units.get(unitCode);
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
  }))
  .views(self => ({
    get appName() { return self.configMgr.appName; },
    get pageTitle() { return self.configMgr.pageTitle; },
    get demoProblemTitle() { return self.configMgr.demoProblemTitle; },
    get defaultProblemOrdinal() { return self.configMgr.defaultProblemOrdinal; },
    get autoAssignStudentsToIndividualGroups() { return self.configMgr.autoAssignStudentsToIndividualGroups; },
    get defaultDocumentType() { return self.configMgr.defaultDocumentType; },
    get defaultDocumentTitle() { return self.configMgr.defaultDocumentTitle; },
    get docTimeStampPropertyName() { return self.configMgr.docTimeStampPropertyName; },
    get docDisplayIdPropertyName() { return self.configMgr.docDisplayIdPropertyName; },
    get hasDefaultDocumentTemplate() { return !!self.configMgr.defaultDocumentTemplate; },
    get defaultLearningLogTitle() { return self.configMgr.defaultLearningLogTitle; },
    get initialLearningLogTitle() { return self.configMgr.initialLearningLogTitle; },
    get defaultLearningLogDocument() { return self.configMgr.defaultLearningLogDocument; },
    get autoSectionProblemDocuments() { return self.configMgr.autoSectionProblemDocuments; },
    get documentLabelProperties() { return self.configMgr.documentLabelProperties; },
    get documentLabels() { return self.configMgr.documentLabels; },
    get disablePublish() { return self.configMgr.disablePublish; },
    get copyPreferOriginTitle() { return self.configMgr.copyPreferOriginTitle; },
    get disableTileDrags() { return self.configMgr.disableTileDrags; },
    get showClassSwitcher() { return self.configMgr.showClassSwitcher; },
    get supportStackedTwoUpView() { return self.configMgr.supportStackedTwoUpView; },
    get showPublishedDocsInPrimaryWorkspace() { return self.configMgr.showPublishedDocsInPrimaryWorkspace; },
    get comparisonPlaceholderContent() { return self.configMgr.comparisonPlaceholderContent; },
    get placeholderText() { return self.configMgr.placeholderText; },
    get stamps() { return self.configMgr.stamps; },
    getSetting(key: string, group?: string) {
      const groupSettings = group ? self.settings?.[group] as SnapshotIn<typeof SettingsGroupMstType> : undefined;
      return groupSettings?.[key] || self.settings?.[key];
    }
  }))
  .views(self => ({
    getDisabledFeaturesOfSection(section?: SectionModelType) {
      let disabledFeatures = self.disabledFeatures;
      if (section) {
        const disabled: Record<string ,string> = {};
        mergeDisabledFeatures(disabled, disabledFeatures);
        mergeDisabledFeatures(disabled, section.disabled);
        disabledFeatures = Object.values(disabled);
      }
      return disabledFeatures;
    },
    isFeatureSupported(feature: string, section?: SectionModelType) {
      const disabledFeatures = this.getDisabledFeaturesOfSection(section);
      const featureIndex = disabledFeatures?.findIndex(f => f === feature || f === `!${feature}`);
      return featureIndex >= 0 ? disabledFeatures[featureIndex][0] === "!" : true;
    },
    getDisabledFeaturesOfTile(tile: string, section?: SectionModelType) {
      const disabledFeatures = this.getDisabledFeaturesOfSection(section)
                                .filter(feature => (!tile || feature.includes(tile)) && (feature[0] !== "!"));
      return disabledFeatures;
    },
    get defaultDocumentContent(): DocumentContentModelType | undefined {
      return DocumentContentModel.create(self.configMgr.defaultDocumentTemplate);
    },
    getDocumentLabel(docType: string, num?: number, lowerCase?: boolean) {
      const docLabel = self.documentLabels[docType];
      return docLabel ? DocumentLabelModel.create(docLabel).getLabel(num, lowerCase) : "";
    }
  }));
export interface AppConfigModelType extends Instance<typeof AppConfigModel> {}
export interface AppConfigModelSnapshot extends SnapshotIn<typeof AppConfigModel> {}
