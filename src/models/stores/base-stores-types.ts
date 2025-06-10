import { AppConfigModelType } from "./app-config-model";
import { UnitModelType } from "../curriculum/unit";
import { InvestigationModelType } from "../curriculum/investigation";
import { ProblemModelType } from "../curriculum/problem";
import { UIModelType } from "./ui";
import { PersistentUIModelType } from "./persistent-ui/persistent-ui";
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
import { Bookmarks } from "./bookmarks";
import { ICurriculumConfig } from "./curriculum-config";

export interface IGitInfo {
  gitSha?: string|null;
  branch?: string|null;
  tag?: string|null;
  date?: string|null;
}

export interface IBaseStores {
  appMode: AppMode;
  appVersion: string;
  gitInfo: IGitInfo;
  appConfig: AppConfigModelType;
  curriculumConfig: ICurriculumConfig;
  unit: UnitModelType;
  investigation: InvestigationModelType;
  problem: ProblemModelType;
  teacherGuide?: ProblemModelType;
  user: UserModelType;
  persistentUI: PersistentUIModelType;
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
  bookmarks: Bookmarks;
}
