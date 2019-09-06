// application-specific code exported here
import { AppConfigSpec } from "./models/stores/app-config-model.js";
import * as appConfigJson from "./clue/app-config.json";
export const appConfigSpec = appConfigJson as AppConfigSpec;
export { createStores } from "./models/stores/stores";
