import { merge } from "lodash";
import { Instance, types } from "mobx-state-tree";
import { AppConfigModel, AppConfigModelSnapshot, UnitSpecModel } from "./app-config-model";
import { UnitConfiguration } from "./unit-configuration";

const PartialAppConfigModel = types
  .model("PartialAppConfig", {
    // the set of curriculum units available
    units: types.map(UnitSpecModel),
    // unit code overrides (legacy unit code support)
    unitCodeMap: types.map(types.string),
    // default problem to load if none specified
    defaultUnit: "",
    // default unit configuration
    config: types.maybe(types.frozen<Partial<UnitConfiguration>>())
  });
interface PartialAppConfigModelSnapshot extends Partial<Instance<typeof PartialAppConfigModel>> {}

/*
 * specAppConfig - utility function for generating appConfigs for tests
 */
export function specAppConfig(overrides?: PartialAppConfigModelSnapshot) {
  return AppConfigModel.create(merge({
    units: {},
    unitCodeMap: {},
    defaultUnit: "",
    config: {
      appName: "Test",
      defaultProblemOrdinal: "1.1",
      disabledFeatures: [""]
    } as UnitConfiguration
  }, overrides) as AppConfigModelSnapshot);
}
