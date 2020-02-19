// application-specific code exported here
import { AppConfigSpec } from "./models/stores/app-config-model.js";
import appConfigJson from "./dataflow/app-config.json";
export const appConfigSpec = appConfigJson as AppConfigSpec;
export { createStores } from "./dataflow/models/stores/dataflow-stores";
export { BaseComponent, IBaseProps } from "./dataflow/components/dataflow-base";
import { DataflowAppContentComponent } from "./dataflow/components/dataflow-app-content";
export const AppContentComponent = DataflowAppContentComponent;
import "./dataflow/dataflow.sass";
