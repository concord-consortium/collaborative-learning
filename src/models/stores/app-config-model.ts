import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { SectionModelType } from "../curriculum/section";
import { ToolbarButtonModel } from "../tiles/toolbar-button";
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
    // default unit configuration
    config: types.frozen<UnitConfiguration>()
  })
  .volatile(self => ({
    configMgr: new ConfigurationManager(self.config, []),
    navTabs: NavTabsConfigModel.create(self.config?.navTabs || {}),
    disabledFeatures: self.config?.disabledFeatures || [],
    toolbar: ToolbarModel.create(self.config?.toolbar || []),
    authorTools: ToolbarModel.create(self.config?.authorTools || []),
    settings: self.config?.settings,
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
    get appName() { return self.configMgr.appName; },
    get pageTitle() { return self.configMgr.pageTitle; },
    get demoProblemTitle() { return self.configMgr.demoProblemTitle; },
    get defaultProblemOrdinal() { return self.configMgr.defaultProblemOrdinal; },
    get autoAssignStudentsToIndividualGroups() { return self.configMgr.autoAssignStudentsToIndividualGroups; },
    get defaultDocumentType() { return self.configMgr.defaultDocumentType; },
    get defaultDocumentTitle() { return self.configMgr.defaultDocumentTitle; },
    get docTimeStampPropertyName() { return self.configMgr.docTimeStampPropertyName; },
    get docDisplayIdPropertyName() { return self.configMgr.docDisplayIdPropertyName; },
    get defaultDocumentTemplate() { return self.configMgr.defaultDocumentTemplate; },
    get planningTemplate() { return self.configMgr.planningTemplate; },
    get defaultLearningLogTitle() { return self.configMgr.defaultLearningLogTitle; },
    get initialLearningLogTitle() { return self.configMgr.initialLearningLogTitle; },
    get defaultLearningLogDocument() { return self.configMgr.defaultLearningLogDocument; },
    get autoSectionProblemDocuments() { return self.configMgr.autoSectionProblemDocuments; },
    get showCommentTag() { return self.configMgr.showCommentTag; },
    get commentTags() { return self.configMgr.commentTags; },
    get tagPrompt() { return self.configMgr.tagPrompt; },
    get documentLabelProperties() { return self.configMgr.documentLabelProperties; },
    get documentLabels() { return self.configMgr.documentLabels; },
    get disablePublish() { return self.configMgr.disablePublish; },
    get enableHistoryRoles() { return self.configMgr.enableHistoryRoles; },
    get copyPreferOriginTitle() { return self.configMgr.copyPreferOriginTitle; },
    get disableTileDrags() { return self.configMgr.disableTileDrags; },
    get showClassSwitcher() { return self.configMgr.showClassSwitcher; },
    get supportStackedTwoUpView() { return self.configMgr.supportStackedTwoUpView; },
    get showPublishedDocsInPrimaryWorkspace() { return self.configMgr.showPublishedDocsInPrimaryWorkspace; },
    get comparisonPlaceholderContent() { return self.configMgr.comparisonPlaceholderContent; },
    get placeholderText() { return self.configMgr.placeholderText; },
    get stamps() { return self.configMgr.stamps; },
    get tools() { return self.configMgr.tools; },
    get annotations() { return self.configMgr.annotations; },
    get initiallyHideExemplars() { return self.configMgr.initiallyHideExemplars; },
    get authorToolbar() {
      return ToolbarModel.create([
        ...self.toolbar.map(button => ToolbarButtonModel.create(getSnapshot(button))),
        ...self.authorTools.map(button => ToolbarButtonModel.create(getSnapshot(button)))
      ]);
    },
    /**
     * Gets the configuration, if any, for the given item.
     * For example, to look up what buttons (aka tools) should be on the table tile's toolbar,
     * the key would be "tools" and group would be "table".
     */
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
    getDocumentLabel(docType: string, num?: number, lowerCase?: boolean) {
      const docLabel = self.documentLabels[docType];
      return docLabel ? DocumentLabelModel.create(docLabel).getLabel(num, lowerCase) : "";
    }
  }));
export interface AppConfigModelType extends Instance<typeof AppConfigModel> {}
export interface AppConfigModelSnapshot extends SnapshotIn<typeof AppConfigModel> {}
