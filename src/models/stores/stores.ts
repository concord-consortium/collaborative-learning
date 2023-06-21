import { addDisposer } from "mobx-state-tree";
import { computed, makeObservable, observable, when } from "mobx";
import { AppConfigModel, AppConfigModelType } from "./app-config-model";
import { createUnitWithoutContent, getGuideJson, getUnitJson, UnitModel, UnitModelType } from "../curriculum/unit";
import { InvestigationModel, InvestigationModelType } from "../curriculum/investigation";
import { ProblemModel, ProblemModelType } from "../curriculum/problem";
import { UIModel, UIModelType } from "./ui";
import { UserModel, UserModelType } from "./user";
import { GroupsModel, GroupsModelType } from "./groups";
import { ClassModel, ClassModelType } from "./class";
import { DB } from "../../lib/db";
import { UserContextProvider } from "./user-context-provider";
import { registerTileTypes } from "../../register-tile-types";
import { DemoModel, DemoModelType } from "./demo";
import { SupportsModel, SupportsModelType } from "./supports";
import { DocumentsModel, createDocumentsModelWithRequiredDocuments, DocumentsModelType } from "./documents";
import { LearningLogDocument, PersonalDocument, PlanningDocument, ProblemDocument } from "../document/document-types";
import { LearningLogWorkspace, ProblemWorkspace } from "./workspace";
import { ClipboardModel, ClipboardModelType } from "./clipboard";
import { SelectionStoreModel, SelectionStoreModelType } from "./selection";
import { AppMode } from "./store-types";
import { SerialDevice } from "./serial";
import { IBaseStores } from "./base-stores-types";
import { NavTabModelType } from "../view/nav-tabs";

export interface IStores extends IBaseStores {
  problemPath: string;
  problemOrdinal: string;
  userContextProvider: UserContextProvider;
  tabsToDisplay: NavTabModelType[];
  isShowingTeacherContent: boolean;
}

export interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

// all possible required document types; not all applications/instances require all documents
const requiredDocumentTypes = [PersonalDocument, PlanningDocument, ProblemDocument, LearningLogDocument];

export function createStores(params?: ICreateStores): IStores {
  return new Stores(params);
}

export class Stores implements IStores{
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
  userContextProvider: UserContextProvider;

  constructor(params?: ICreateStores){
    makeObservable(this, {
      appMode: observable,
      teacherGuide: observable,
      unit: observable,
      investigation: observable,
      problem: observable,
      tabsToDisplay: computed,
      problemPath: computed,
      problemOrdinal: computed
    });

    this.appMode = params?.appMode || "dev";
    this.isPreviewing = params?.isPreviewing || false;
    this.appVersion = params?.appVersion || "unknown";
    this.appConfig = params?.appConfig || AppConfigModel.create();

    // for testing, we create a null problem or investigation if none is provided
    this.investigation = params?.investigation ||
      InvestigationModel.create({ ordinal: 0, title: "Null Investigation" });
    this.problem = params?.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" });
    this.user = params?.user || UserModel.create({ id: "0" });
    this.ui = params?.ui || UIModel.create({
        problemWorkspace: {
          type: ProblemWorkspace,
          mode: "1-up"
        },
        learningLogWorkspace: {
          type: LearningLogWorkspace,
          mode: "1-up"
        },
      });
    this.groups = params?.groups || GroupsModel.create({ acceptUnknownStudents: params?.isPreviewing });
    // TODO: is the word "class" here ok?
    this.class = params?.class || ClassModel.create({ name: "Null Class", classHash: "" });
    this.db = params?.db || new DB();
    this.documents = params?.documents || createDocumentsModelWithRequiredDocuments(requiredDocumentTypes);
    this.networkDocuments = params?.networkDocuments || DocumentsModel.create({});
    this.unit = params?.unit || UnitModel.create({code: "NULL", title: "Null Unit"});
    const demoName = params?.demoName || this.appConfig.appName;
    this.demo = params?.demo || DemoModel.create({name: demoName, class: {id: "0", name: "Null Class"}});
    this.showDemoCreator = params?.showDemoCreator || false;
    this.supports = params?.supports || SupportsModel.create({});
    this.clipboard = ClipboardModel.create();
    this.selection = SelectionStoreModel.create();
    this.serialDevice = new SerialDevice();
    this.ui.setProblemPath(this.problemPath);
    this.userContextProvider = new UserContextProvider(this);
  }

  get tabsToDisplay() {
    const { appConfig: { navTabs: navTabSpecs },
      teacherGuide,
      user: { isTeacher }
    } = this;

    return isTeacher
      ? navTabSpecs.tabSpecs.filter(t => (t.tab !== "teacher-guide") || teacherGuide)
      : navTabSpecs.tabSpecs.filter(t => !t.teacherOnly);
  }

  get problemPath() {
    return `${this.unit.code}/${this.investigation.ordinal}/${this.problem.ordinal}`;
  }

  get problemOrdinal() {
    const { investigation, problem } = this;
    return `${investigation.ordinal}.${problem.ordinal}`;
  }

  get isShowingTeacherContent() {
    const { ui: { showTeacherContent }, user: { isTeacher } } = this;
    return isTeacher && showTeacherContent;
  }
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
  const { authorTools = [], toolbar = [], tools: tileTypes = [] } = stores.appConfig;
  const unitTileTypes = new Set(
    [...toolbar.map(button => button.id), ...authorTools.map(button => button.id), ...tileTypes]);
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
  stores.ui.setProblemPath(stores.problemPath);

  // Set the active tab to be the first tab
  const tabs = stores.tabsToDisplay;
  if (tabs.length > 0) {
    stores.ui.setActiveNavTab(tabs[0].tab);
  }

  addDisposer(unit, when(() => {
      return stores.user.isTeacher;
    },
    async () => {
      // Uncomment the next line to add a 5 second delay.
      // This is useful to test whether the teacher guide tab shows when there is a network delay.
      // await new Promise((resolve) => setTimeout(resolve, 5000));

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
