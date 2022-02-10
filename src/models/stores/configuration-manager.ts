import { merge } from "lodash";
import { UnitConfiguration } from "./unit-configuration";

type UC = UnitConfiguration;

export class ConfigurationManager implements UnitConfiguration {

  private defaults: UnitConfiguration;
  private configs: Array<Partial<UnitConfiguration>>;

  // input configs should be top-to-bottom, e.g. unit, investigation, problem
  constructor(defaults: UnitConfiguration, configs: Array<Partial<UnitConfiguration>>) {
    this.defaults = defaults;
    // reverse the array so searches are bottom-to-top, e.g. problem, investigation, unit
    this.configs = [...configs].reverse();
  }

  getProp<T>(prop: keyof UnitConfiguration) {
    const found = this.configs.find(config => config[prop] != null)?.[prop];
    return (found != null ? found : this.defaults[prop]) as T;
  }

  /*
   * UnitConfiguration properties
   */
  get appName() {
    return this.getProp<UC["appName"]>("appName");
  }

  get pageTitle() {
    return this.getProp<UC["pageTitle"]>("pageTitle");
  }

  get demoProblemTitle() {
    return this.getProp<UC["demoProblemTitle"]>("demoProblemTitle");
  }

  get defaultProblemOrdinal() {
    return this.getProp<UC["defaultProblemOrdinal"]>("defaultProblemOrdinal");
  }

  get autoAssignStudentsToIndividualGroups() {
    return this.getProp<UC["autoAssignStudentsToIndividualGroups"]>("autoAssignStudentsToIndividualGroups");
  }

  get defaultDocumentType() {
    return this.getProp<UC["defaultDocumentType"]>("defaultDocumentType");
  }

  get defaultDocumentTitle() {
    return this.getProp<UC["defaultDocumentTitle"]>("defaultDocumentTitle");
  }

  get docTimeStampPropertyName() {
    return this.getProp<UC["docTimeStampPropertyName"]>("docTimeStampPropertyName");
  }

  get docDisplayIdPropertyName() {
    return this.getProp<UC["docDisplayIdPropertyName"]>("docDisplayIdPropertyName");
  }

  get defaultDocumentTemplate() {
    return this.getProp<UC["defaultDocumentTemplate"]>("defaultDocumentTemplate");
  }

  get defaultLearningLogTitle() {
    return this.getProp<UC["defaultLearningLogTitle"]>("defaultLearningLogTitle");
  }

  get initialLearningLogTitle() {
    return this.getProp<UC["initialLearningLogTitle"]>("initialLearningLogTitle");
  }

  get defaultLearningLogDocument() {
    return this.getProp<UC["defaultLearningLogDocument"]>("defaultLearningLogDocument");
  }

  get autoSectionProblemDocuments() {
    return this.getProp<UC["autoSectionProblemDocuments"]>("autoSectionProblemDocuments");
  }

  get documentLabelProperties() {
    return this.getProp<UC["documentLabelProperties"]>("documentLabelProperties");
  }

  get documentLabels() {
    return this.getProp<UC["documentLabels"]>("documentLabels");
  }

  get disablePublish() {
    return this.getProp<UC["disablePublish"]>("disablePublish");
  }

  get copyPreferOriginTitle() {
    return this.getProp<UC["copyPreferOriginTitle"]>("copyPreferOriginTitle");
  }

  get disableTileDrags() {
    return this.getProp<UC["disableTileDrags"]>("disableTileDrags");
  }

  get showClassSwitcher() {
    return this.getProp<UC["showClassSwitcher"]>("showClassSwitcher");
  }

  get supportStackedTwoUpView() {
    return this.getProp<UC["supportStackedTwoUpView"]>("supportStackedTwoUpView");
  }

  get showPublishedDocsInPrimaryWorkspace() {
    return this.getProp<UC["showPublishedDocsInPrimaryWorkspace"]>("showPublishedDocsInPrimaryWorkspace");
  }

  get comparisonPlaceholderContent() {
    return this.getProp<UC["comparisonPlaceholderContent"]>("comparisonPlaceholderContent");
  }

  get navTabs() {
    return this.getProp<UC["navTabs"]>("navTabs");
  }

  /*
   * ProblemConfiguration properties
   */
  get disabledFeatures() {
    // settings are merged rather than simply returning the closest non-empty value
    const reverseConfigs = [...this.configs].reverse();
    const mergedDisabled: Record<string, string> = {};

    mergeDisabledFeatures(mergedDisabled, this.defaults.disabledFeatures);
    for (const config of reverseConfigs) {
      mergeDisabledFeatures(mergedDisabled, config.disabledFeatures);
    }

    return Object.values(mergedDisabled);
  }

  get toolbar() {
    return this.getProp<UC["toolbar"]>("toolbar");
  }

  get placeholderText() {
    return this.getProp<UC["placeholderText"]>("placeholderText");
  }

  get stamps() {
    return this.getProp<UC["stamps"]>("stamps");
  }

  get settings(): UC["settings"]  {
    // settings are merged rather than simply returning the closest non-empty value
    const reverseSettings = [...this.configs].reverse().map(config => config.settings);
    return merge({}, this.defaults.settings, ...reverseSettings);
  }
}

export function mergeDisabledFeatures(disabled: Record<string, string>, disabledFeatures?: string[]) {
  disabledFeatures?.forEach(feature => {
    const result = /^!?(.+)/.exec(feature);
    const featureKey = result?.[1];
    featureKey && (disabled[featureKey] = feature);
  });
}
