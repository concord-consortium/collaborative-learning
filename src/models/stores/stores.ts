import { AppConfigModelType, AppConfigModel } from "./app-config-model";
import { createUnitWithoutContent, getGuideJson, getUnitJson, UnitModel, UnitModelType } from "../curriculum/unit";
import { InvestigationModelType, InvestigationModel } from "../curriculum/investigation";
import { ProblemModel, ProblemModelType } from "../curriculum/problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";
import { GroupsModel, GroupsModelType } from "./groups";
import { ClassModel, ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { registerTools } from "../../register-tools";
import { DemoModelType, DemoModel } from "./demo";
import { SupportsModel, SupportsModelType } from "./supports";
import { DocumentsModelType, DocumentsModel, createDocumentsModelWithRequiredDocuments } from "./documents";
import { LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument } from "../document/document-types";
import { LearningLogWorkspace, ProblemWorkspace } from "./workspace";
import { ClipboardModel, ClipboardModelType } from "./clipboard";
import { SelectionStoreModel, SelectionStoreModelType } from "./selection";
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

export interface IStores extends IBaseStores {
  problemPath: string;
}

export interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

// all possible required document types; not all applications/instances require all documents
const requiredDocumentTypes = [PersonalDocument, PlanningDocument, ProblemDocument, LearningLogDocument];

export function createStores(params?: ICreateStores): IStores {
  const user = params?.user || UserModel.create({ id: "0" });
  const appConfig = params?.appConfig || AppConfigModel.create();
  const demoName = params?.demoName || appConfig.appName;
  const stores: IBaseStores = {
    appMode: params?.appMode || "dev",
    isPreviewing: params?.isPreviewing || false,
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
    documents: params?.documents || createDocumentsModelWithRequiredDocuments(requiredDocumentTypes),
    networkDocuments: params?.networkDocuments || DocumentsModel.create({}),
    unit: params?.unit || UnitModel.create({code: "NULL", title: "Null Unit"}),
    demo: params?.demo || DemoModel.create({name: demoName, class: {id: "0", name: "Null Class"}}),
    showDemoCreator: params?.showDemoCreator || false,
    supports: params?.supports || SupportsModel.create({}),
    clipboard: ClipboardModel.create(),
    selection: SelectionStoreModel.create(),
    serialDevice: new SerialDevice()
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

  // read the unit content, but don't instantiate section contents (DocumentModels) yet
  const unit = createUnitWithoutContent(unitJson);

  const _problemOrdinal = problemOrdinal || stores.appConfig.defaultProblemOrdinal;
  const { investigation: _investigation, problem: _problem } = unit.getProblem(_problemOrdinal);

  stores.appConfig.setConfigs([unit.config || {}, _investigation?.config || {}, _problem?.config || {}]);

  // load/initialize the necessary tools
  const { toolbar = [], tools = [] } = stores.appConfig;
  const unitToolIds = new Set([...toolbar.map(tool => tool.id), ...tools]);
  await registerTools([...unitToolIds]);

  // read the unit content with full contents now that we have tools
  stores.unit = UnitModel.create(unitJson);
  const {investigation, problem} = stores.unit.getProblem(_problemOrdinal);

  stores.documents.setAppConfig(stores.appConfig);
  if (investigation && problem) {
    stores.investigation = investigation;
    stores.problem = problem;
  }
  stores.problemPath = getProblemPath(stores);

  // need to use a listener because user type can be determined after unit initialization
  unit.installUserListener(() => stores.user.isTeacher, async (isTeacher: boolean) => {
    // only load the teacher guide content for teachers
    if (isTeacher) {
      const guideJson = await getGuideJson(unitId, stores.appConfig);
      const unitGuide = guideJson && UnitModel.create(guideJson);
      const teacherGuide = unitGuide?.getProblem(problemOrdinal || stores.appConfig.defaultProblemOrdinal)?.problem;
      stores.teacherGuide = teacherGuide;
    }
  });
};

export function isShowingTeacherContent(stores: IStores) {
  const { ui: { showTeacherContent }, user: { isTeacher } } = stores;
  return isTeacher && showTeacherContent;
}
