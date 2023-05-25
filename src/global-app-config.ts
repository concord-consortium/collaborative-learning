import { appConfigSnapshot } from "./app-config";
import { AppConfigModel } from "./models/stores/app-config-model";

/*
 * The global appConfig is added to the stores in initializeApp() and to the
 * MST environment in createDocumentModel().
 */
export const gAppConfig = AppConfigModel.create(appConfigSnapshot);
