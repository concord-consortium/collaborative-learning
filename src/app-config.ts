// application-specific code exported here
import { AppConfigModelSnapshot } from "./models/stores/app-config-model.js";
import appConfigJson from "./clue/app-config.json";
export const appConfigSnapshot = appConfigJson as AppConfigModelSnapshot;
export { createStores } from "./models/stores/stores";
export { BaseComponent, type IBaseProps } from "./components/base";
import { ClueAppContentComponent } from "./clue/components/clue-app-content";
export const AppContentComponent = ClueAppContentComponent;
export { appIcons } from "./clue/app-icons";
import "./clue/clue.scss";

// register the tools built into the application
import "./register-tile-types";
