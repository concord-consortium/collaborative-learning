import { AppConfigModelType, AppConfigModel } from "./app-config-model";
import { getGuideJson, getUnitJson, UnitModel, UnitModelType } from "../curriculum/unit";
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
import { getSetting } from "./settings";
import { AppMode } from "./store-types";

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

export interface IStores extends IBaseStores {
  problemPath: string;
}

interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

export function createStores(params?: ICreateStores): IStores {
  const user = params?.user || UserModel.create({ id: "0" });
  const appConfig = params?.appConfig || AppConfigModel.create();
  const demoName = params?.demoName || appConfig.appName;
  const stores: IBaseStores = {
    appMode: params?.appMode || "dev",
    appVersion: params?.appVersion || "unknown",
    appConfig,
    // for testing, we create a null problem or investigation if none is provided
    investigation: params?.investigation || InvestigationModel.create({ ordinal: 0, title: "Null Investigation" }),
    problem: params?.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" }),
    user,
    ui: params?.ui || UIModel.create({
      problemWorkspace: {
        type: ProblemWorkspace,
        mode: "1-up"
      },
      learningLogWorkspace: {
        type: LearningLogWorkspace,
        mode: "1-up"
      },
    }),
    groups: params?.groups || GroupsModel.create({ acceptUnknownStudents: params?.isPreviewing }),
    class: params?.class || ClassModel.create({ name: "Null Class", classHash: "" }),
    db: params?.db || new DB(),
    documents: params?.documents || DocumentsModel.create({}),
    unit: params?.unit || UnitModel.create({code: "NULL", title: "Null Unit"}),
    demo: params?.demo || DemoModel.create({name: demoName, class: {id: "0", name: "Null Class"}}),
    showDemoCreator: params?.showDemoCreator || false,
    supports: params?.supports || SupportsModel.create({}),
    clipboard: ClipboardModel.create(),
    selection: SelectionStoreModel.create()
  };
  return {
    ...stores,
    problemPath: getProblemPath(stores)
  };
}

export function setAppMode(stores: IStores, appMode: AppMode) {
  stores.appMode = appMode;
}

export function getProblemOrdinal(stores: IBaseStores) {
  const { investigation, problem } = stores;
  return `${investigation.ordinal}.${problem.ordinal}`;
}

export function getProblemPath(stores: IBaseStores) {
  return `${stores.unit.code}/${stores.investigation.ordinal}/${stores.problem.ordinal}`;
}

export const setUnitAndProblem = async (stores: IStores, unitId: string | undefined, problemOrdinal?: string) => {
  const unitJson = await getUnitJson(unitId, stores.appConfig);
  const unit = UnitModel.create(unitJson);
  const {investigation, problem} = unit.getProblem(problemOrdinal || stores.appConfig.defaultProblemOrdinal);

  stores.unit = unit;
  stores.documents.setUnit(stores.unit);
  if (investigation && problem) {
    stores.investigation = investigation;
    stores.problem = problem;
  }
  stores.problemPath = getProblemPath(stores);

  const guideJson = await getGuideJson(unitId, stores.appConfig);
  const unitGuide = guideJson && UnitModel.create(guideJson);
  const teacherGuide = unitGuide?.getProblem(problemOrdinal || stores.appConfig.defaultProblemOrdinal)?.problem;
  if (teacherGuide) {
    stores.teacherGuide = teacherGuide;
  }
};

export function isShowingTeacherContent(stores: IStores) {
  const { ui: { showTeacherContent }, user: { isTeacher } } = stores;
  return isTeacher && showTeacherContent;
}

export function isFeatureSupported(stores: IStores, feature: string, sectionId?: string) {
  const { unit, investigation, problem } = stores;
  const section = sectionId && problem.getSectionById(sectionId);
  return [unit, investigation, problem, section].reduce((prev, level) => {
    const featureIndex = level ? level.disabled.findIndex(f => f === feature || f === `!${feature}`) : -1;
    const isEnabledAtLevel = featureIndex >= 0 && level ? level.disabled[featureIndex][0] === "!" : true;
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

export function getSettingFromStores(stores: IStores, key: string, group?: string) {
  for (const level of [stores.problem, stores.investigation, stores.unit, stores.appConfig]) {
    const value = level.settings && getSetting(level.settings, key, group);
    if (value != null) return value;
  }
}
