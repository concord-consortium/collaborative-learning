import { specAppConfig } from "./spec-app-config";
import { createStores, ICreateStores } from "./stores";

/*
 * specStores - utility function for generating default stores for tests
 */
export function specStores(overrides?: ICreateStores) {
  const appConfig = overrides?.appConfig || specAppConfig();
  const stores = createStores({ ...overrides, appConfig });
  const { unit, investigation, problem } = stores;
  stores.appConfig.setConfigs([unit?.config || {}, investigation?.config || {}, problem?.config || {}]);
  return stores;
}
