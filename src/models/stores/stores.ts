import { AppConfigModelType, AppConfigModel } from "./app-config-model";
import { UnitModelType, UnitModel } from "../curriculum/unit";
import { InvestigationModelType, InvestigationModel } from "../curriculum/investigation";
import { ProblemModel, ProblemModelType } from "../curriculum/problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";
import { GroupsModel, GroupsModelType } from "./groups";
import { ClassModel, ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { DemoModelType, DemoModel } from "./demo";
import { SupportsModel, SupportsModelType } from "./supports";
import { DocumentsModelType, DocumentsModel } from "./documents";
import { LearningLogWorkspace, ProblemWorkspace } from "./workspace";
import { ClipboardModel, ClipboardModelType } from "./clipboard";
import { SelectionStoreModel, SelectionStoreModelType } from "./selection";

export type AppMode = "authed" | "dev" | "test" | "demo" | "qa";

export interface IStores {
  appMode: AppMode;
  appVersion: string;
  appConfig: AppConfigModelType;
  unit: UnitModelType;
  investigation: InvestigationModelType;
  problem: ProblemModelType;
  user: UserModelType;
  ui: UIModelType;
  groups: GroupsModelType;
  class: ClassModelType;
  documents: DocumentsModelType;
  db: DB;
  demo: DemoModelType;
  showDemoCreator: boolean;
  supports: SupportsModelType;
  clipboard: ClipboardModelType;
  selection: SelectionStoreModelType;
}

interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

export function createStores(params?: ICreateStores): IStores {
  const user = params && params.user || UserModel.create({ id: "0" });
  const appConfig = params && params.appConfig || AppConfigModel.create();
  const demoName = params && params.demoName || appConfig.appName;
  return {
    appMode: params && params.appMode ? params.appMode : "dev",
    appVersion: params && params.appVersion || "unknown",
    appConfig,
    // for testing, we create a null problem or investigation if none is provided
    investigation: params && params.investigation || InvestigationModel.create({
      ordinal: 0, title: "Null Investigation"}),
    problem: params && params.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" }),
    user,
    ui: params && params.ui || UIModel.create({
      problemWorkspace: {
        type: ProblemWorkspace,
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
    demo: params && params.demo || DemoModel.create({name: demoName, class: {id: "0", name: "Null Class"}}),
    showDemoCreator: params && params.showDemoCreator || false,
    supports: params && params.supports || SupportsModel.create({}),
    clipboard: ClipboardModel.create(),
    selection: SelectionStoreModel.create()
  };
}

export function isFeatureSupported(stores: IStores, feature: string, sectionId?: string) {
  const { unit, investigation, problem } = stores;
  const section = sectionId && problem.getSectionById(sectionId);
  return [unit, investigation, problem, section].reduce((prev, level) => {
    const featureIndex = level ? level.disabled.findIndex(f => f === feature || f === `!${feature}`) : -1;
    const isEnabledAtLevel = featureIndex >= 0 && level && level.disabled[featureIndex][0] === "!";
    return featureIndex >= 0 ? isEnabledAtLevel : prev;
  }, true);
}

export function getDisabledFeaturesOfTile(stores: IStores, tile: string, sectionId?: string) {
  const { unit, investigation, problem } = stores;
  const section = sectionId && problem.getSectionById(sectionId);
  const disabledMap: { [feature: string]: boolean } = {};
  [unit, investigation, problem, section]
    .forEach((level, index) => {
      level && level.disabled.forEach(feature => {
        const regex = new RegExp(`(!)?(${tile}.+)`);
        const match = regex.exec(feature);
        if (match && match[2]) {
          disabledMap[match[2]] = !match[1];
        }
      });
    });
  return Object.keys(disabledMap).reduce<string[]>((prev, feature) => {
    disabledMap[feature] && prev.push(feature);
    return prev;
  }, []);
}
