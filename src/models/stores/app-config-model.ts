import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { SectionModelType } from "../curriculum/section";
import { ToolbarButtonModel } from "../tiles/toolbar-button";
import { ConfigurationManager, mergeDisabledFeatures } from "./configuration-manager";
import { NavTabsConfigModel } from "./nav-tabs";
import { ToolbarModel } from "./problem-configuration";
import { SettingsGroupMstType } from "./settings";
import { DocumentLabelModel, UnitConfiguration } from "./unit-configuration";
import { UserType } from "./user-types";

interface IMyResourcesToolbarOptions {
  showEdit?: boolean;
  showPlayback?: boolean;
  show4Up?: boolean;
}

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
    myResourcesToolBar: ToolbarModel.create(self.config?.myResourcesToolbar || []),
    settings: self.config?.settings,
    requireSortWorkTab: false
  }))
  .actions(self => ({
    setConfigs(configs: Partial<UnitConfiguration>[]) {
      self.configMgr = new ConfigurationManager(self.config, configs);
      self.navTabs = NavTabsConfigModel.create(self.configMgr.navTabs);
      if (self.requireSortWorkTab) {
        self.navTabs.addSortWorkTab();
      }
      self.disabledFeatures = self.configMgr.disabledFeatures;
      self.authorTools = ToolbarModel.create(self.configMgr.authorTools);
      self.toolbar = ToolbarModel.create(self.configMgr.toolbar);
      self.settings = self.configMgr.settings;
    },
    setRequireSortWorkTab(requireSortWorkTab: boolean) {
      self.requireSortWorkTab = requireSortWorkTab;
      if (requireSortWorkTab) {
        self.navTabs.addSortWorkTab();
      }
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
    get aiEvaluation() { return self.configMgr.aiEvaluation; },
    get aiPrompt() { return self.configMgr.aiPrompt; },
    get documentLabelProperties() { return self.configMgr.documentLabelProperties; },
    get documentLabels() { return self.configMgr.documentLabels; },
    get disablePublish() { return self.configMgr.disablePublish; },
    get enableHistoryRoles() { return self.configMgr.enableHistoryRoles; },
    get enableCommentRoles() { return self.configMgr.enableCommentRoles; },
    get copyPreferOriginTitle() { return self.configMgr.copyPreferOriginTitle; },
    get disableTileDrags() { return self.configMgr.disableTileDrags; },
    get showClassSwitcher() { return self.configMgr.showClassSwitcher; },
    get supportStackedTwoUpView() { return self.configMgr.supportStackedTwoUpView; },
    get showPublishedDocsInPrimaryWorkspace() { return self.configMgr.showPublishedDocsInPrimaryWorkspace; },
    get comparisonPlaceholderContent() { return self.configMgr.comparisonPlaceholderContent; },
    get placeholder() { return self.configMgr.placeholder; },
    get placeholderText() { return self.configMgr.placeholderText; },
    get stamps() { return self.configMgr.stamps; },
    get tools() { return self.configMgr.tools; },
    get annotations() { return self.configMgr.annotations; },
    get initiallyHideExemplars() { return self.configMgr.initiallyHideExemplars; },
    get showIdeasButton() { return self.configMgr.showIdeasButton; },
    get hide4up() { return self.configMgr.hide4up; },
    get sortWorkConfig() { return self.configMgr.sortWorkConfig; },
    get customLabels() { return self.configMgr.customLabels; },
    getCustomLabel(label: string) {
      return self.configMgr.customLabels?.[label] ?? label;
    },
    get authorToolbar() {
      return ToolbarModel.create([
        ...self.toolbar.map(button => ToolbarButtonModel.create(getSnapshot(button))),
        ...self.authorTools.map(button => ToolbarButtonModel.create(getSnapshot(button)))
      ]);
    },
    myResourcesToolbar({showPlayback, showEdit, show4Up}: IMyResourcesToolbarOptions) {
      return ToolbarModel.create([
        ...self.myResourcesToolBar
          .filter(button => {
            if (button.id === "edit") {
              return showEdit;
            }
            if (button.id === "fourUp") {
              return show4Up;
            }
            if (button.id === "togglePlayback") {
              return showPlayback;
            }
            return true;
          })
          .map(button => ToolbarButtonModel.create(getSnapshot(button))),
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
    },
    get showAnnotationControls() {
      return (

        // Controls are enabled by any setting of 'annotation' in the config other than 'none'
        // in the future there will be more options supported.
        (self.annotations && self.annotations !== 'none') ||

        // we also enable it, for back-compatibility, if the toolbar has a 'hide-annotations' button specified
        !!self.toolbar.find(item => item.id === 'hide-annotations')
      );
    },
    getPlaceholder(containerType: string) {
      const key = (containerType === undefined || containerType === "DocumentContent") ? "default" : containerType;
      return self.placeholder?.[key];
    },
    showCommentPanelFor(userType: UserType | undefined) {
      return userType && self.enableCommentRoles.includes(userType);
    }

  }));
export interface AppConfigModelType extends Instance<typeof AppConfigModel> {}
export interface AppConfigModelSnapshot extends SnapshotIn<typeof AppConfigModel> {}
