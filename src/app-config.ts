// application-specific code exported here
import { AppConfigSpec } from "./models/stores/app-config-model.js";
import * as appConfigJson from "./clue/app-config.json";
export const appConfigSpec = appConfigJson as AppConfigSpec;
export { createStores } from "./models/stores/stores";
export { BaseComponent, IBaseProps } from "./components/base";
import { ClueAppContentComponent } from "./clue/components/clue-app-content";
export const AppContentComponent = ClueAppContentComponent;
