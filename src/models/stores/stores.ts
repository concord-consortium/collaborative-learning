import { ProblemModel, ProblemModelType } from "../curriculum/problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";
import { GroupsModel, GroupsModelType } from "./groups";
import { ClassModel, ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { UnitModelType, UnitModel } from "../curriculum/unit";
import { DemoModelType, DemoModel } from "./demo";
import { SupportsModel, SupportsModelType } from "./supports";
import { DocumentsModelType, DocumentsModel } from "./documents";
import { LearningLogWorkspace, SectionWorkspace } from "./workspace";
import { ClipboardModel, ClipboardModelType } from "./clipboard";
import { ThingsModel, ThingsModelType } from "./things";

export type AppMode = "authed" | "dev" | "test" | "demo" | "qa";

export interface IStores {
  appMode: AppMode;
  appVersion: string;
  problem: ProblemModelType;
  user: UserModelType;
  ui: UIModelType;
  groups: GroupsModelType;
  class: ClassModelType;
  documents: DocumentsModelType;
  db: DB;
  unit: UnitModelType;
  demo: DemoModelType;
  showDemoCreator: boolean;
  supports: SupportsModelType;
  clipboard: ClipboardModelType;
  things: ThingsModelType;
}

export interface ICreateStores {
  appMode?: AppMode;
  appVersion?: string;
  problem?: ProblemModelType;
  user?: UserModelType;
  ui?: UIModelType;
  groups?: GroupsModelType;
  class?: ClassModelType;
  documents?: DocumentsModelType;
  db?: DB;
  showDemoCreator?: boolean;
  unit?: UnitModelType;
  demo?: DemoModelType;
  supports?: SupportsModelType;
  things?: ThingsModelType;
}

export function createStores(params?: ICreateStores): IStores {
  const user = params && params.user || UserModel.create({ id: "0" });
  return {
    appMode: params && params.appMode ? params.appMode : "dev",
    appVersion: params && params.appVersion || "unknown",
    // for ease of testing, we create a null problem if none is provided
    problem: params && params.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" }),
    user,
    ui: params && params.ui || UIModel.create({
      sectionWorkspace: {
        type: SectionWorkspace,
        mode: "1-up"
      },
      learningLogWorkspace: {
        type: LearningLogWorkspace,
        mode: "1-up"
      },
    }),
    groups: params && params.groups || GroupsModel.create({}),
    class: params && params.class || ClassModel.create({ name: "Null Class", classHash: "" }),
    db: params && params.db || new DB(),
    documents: params && params.documents || DocumentsModel.create({}),
    unit: params && params.unit || UnitModel.create({title: "Null Unit"}),
    demo: params && params.demo || DemoModel.create({class: {id: "0", name: "Null Class"}}),
    showDemoCreator: params && params.showDemoCreator || false,
    supports: params && params.supports || SupportsModel.create({}),
    clipboard: ClipboardModel.create(),
    things: ThingsModel.create()
  };
}
