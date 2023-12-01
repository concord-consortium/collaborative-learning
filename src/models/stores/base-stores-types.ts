import { AppConfigModelType } from "./app-config-model";
import { UnitModelType } from "../curriculum/unit";
import { InvestigationModelType } from "../curriculum/investigation";
import { ProblemModelType } from "../curriculum/problem";
import { PersistentUIModelType } from "./persistent-ui";
import { UIModelType } from "./ui";
import { UserModelType } from "./user";
import { GroupsModelType } from "./groups";
import { ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { DemoModelType } from "./demo";
import { SupportsModelType } from "./supports";
import { DocumentsModelType } from "./documents";
import { ClipboardModelType } from "./clipboard";
import { SelectionStoreModelType } from "./selection";
import { AppMode } from "./store-types";
import { SerialDevice } from "./serial";


export interface IBaseStores {
  appMode: AppMode;
  isPreviewing?: boolean;
  appVersion: string;
  appConfig: AppConfigModelType;
  unit: UnitModelType;
  investigation: InvestigationModelType;
  problem: ProblemModelType;
  teacherGuide?: ProblemModelType;
  user: UserModelType;
  persistentUi: PersistentUIModelType;
  ui: UIModelType;
  groups: GroupsModelType;
  class: ClassModelType;
  documents: DocumentsModelType;
  networkDocuments: DocumentsModelType;
  db: DB;
  demo: DemoModelType;
  showDemoCreator: boolean;
  supports: SupportsModelType;
  clipboard: ClipboardModelType;
  selection: SelectionStoreModelType;
  serialDevice: SerialDevice;
}
