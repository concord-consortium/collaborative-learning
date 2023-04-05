import { addDisposer } from "mobx-state-tree";
import { when } from "mobx";
import { AppConfigModel } from "./app-config-model";
import { createUnitWithoutContent, getGuideJson, getUnitJson, UnitModel } from "../curriculum/unit";
import { InvestigationModel } from "../curriculum/investigation";
import { ProblemModel } from "../curriculum/problem";
import { UIModel } from "./ui";
import { UserModel } from "./user";
import { GroupsModel } from "./groups";
import { ClassModel } from "./class";
import { DB } from "../../lib/db";
import { UserContextProvider } from "./user-context-provider";
import { registerTileTypes } from "../../register-tile-types";
import { DemoModel } from "./demo";
import { SupportsModel } from "./supports";
import { DocumentsModel, createDocumentsModelWithRequiredDocuments } from "./documents";
import { LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument } from "../document/document-types";
import { LearningLogWorkspace, ProblemWorkspace } from "./workspace";
import { ClipboardModel } from "./clipboard";
import { SelectionStoreModel } from "./selection";
import { AppMode } from "./store-types";
import { SerialDevice } from "./serial";
import { IBaseStores } from "./base-stores-types";

export interface IStores extends IBaseStores {
  problemPath: string;
  userContextProvider: UserContextProvider;
}

export interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

// all possible required document types; not all applications/instances require all documents
const requiredDocumentTypes = [PersonalDocument, PlanningDocument, ProblemDocument, LearningLogDocument];

export function createStores(params?: ICreateStores): IStores {
  const user = params?.user || UserModel.create({ id: "0" });
  const appConfig = params?.appConfig || AppConfigModel.create();
  const appMode = params?.appMode || "dev";
  const demoName = params?.demoName || appConfig.appName;

  const stores: IBaseStores = {
    appMode,
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
    problemPath: getProblemPath(stores),
    userContextProvider: new UserContextProvider(stores)
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
  let unitJson = await getUnitJson(unitId, stores.appConfig);
  if (unitJson.status === 404) {
    unitJson = await getUnitJson(stores.appConfig.defaultUnit, stores.appConfig);
  }

  // read the unit content, but don't instantiate section contents (DocumentModels) yet
  const unit = createUnitWithoutContent(unitJson);

  const _problemOrdinal = problemOrdinal || stores.appConfig.defaultProblemOrdinal;
  const { investigation: _investigation, problem: _problem } = unit.getProblem(_problemOrdinal);

  stores.appConfig.setConfigs([unit.config || {}, _investigation?.config || {}, _problem?.config || {}]);

  // load/initialize the necessary tools
  const { toolbar = [], tools: tileTypes = [] } = stores.appConfig;
  const unitTileTypes = new Set([...toolbar.map(button => button.id), ...tileTypes]);
  await registerTileTypes([...unitTileTypes]);

  // read the unit content with full contents now that we have tools
  stores.unit = UnitModel.create(unitJson);
  const {investigation, problem} = stores.unit.getProblem(_problemOrdinal);

  // TODO: make this dynamic like the way the components work. The components
  // access these values from the stores when they need them. This way the values
  // can be changed on the fly without having to track down each object that is
  // using them.
  stores.documents.setAppConfig(stores.appConfig);
  stores.documents.setFirestore(stores.db.firestore);
  stores.documents.setUserContextProvider(stores.userContextProvider);

  if (investigation && problem) {
    stores.investigation = investigation;
    stores.problem = problem;
  }
  stores.problemPath = getProblemPath(stores);

  // TODO: It would be best to make stores a MobX object so when the teacherGuide is 
  // updated, the Workspace component will re-render to show the teacher guide.
  // It currently works in real-world use, but was causing a Cypress test failure.
  addDisposer(unit, when(() => {
      return stores.user.isTeacher;
    },
    async () => {
      // only load the teacher guide content for teachers
      const guideJson = await getGuideJson(unitId, stores.appConfig);
      if (guideJson.status !== 404) {
        const unitGuide = guideJson && UnitModel.create(guideJson);
        // Not sure if this should be "guide" or "teacher-guide", either ought to work
        unitGuide?.setFacet("teacher-guide");
        const teacherGuide = unitGuide?.getProblem(problemOrdinal || stores.appConfig.defaultProblemOrdinal)?.problem;
        stores.teacherGuide = teacherGuide;
      }
    }
  ));
};

export function isShowingTeacherContent(stores: IStores) {
  const { ui: { showTeacherContent }, user: { isTeacher } } = stores;
  return isTeacher && showTeacherContent;
}
