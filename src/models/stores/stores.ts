import { addDisposer } from "mobx-state-tree";
import { makeAutoObservable, runInAction, when } from "mobx";
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
  setAppMode: (appMode: AppMode) => void;
  initializeStudentWorkTab: () => void;
  setUnitAndProblem: (unitId: string | undefined, problemOrdinal?: string) => Promise<void>;
}

export interface ICreateStores extends Partial<IStores> {
  demoName?: string;
}

// all possible required document types; not all applications/instances require all documents
const requiredDocumentTypes = [PersonalDocument, PlanningDocument, ProblemDocument, LearningLogDocument];

export function createStores(params?: ICreateStores): IStores {
  return new Stores(params);
}

class Stores implements IStores{
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
    // This will mark all properties as observable
    // all getters as computed, all setters as actions
    // and any other function's type will be determined
    // at runtime. It isn't clear from the docs what it
    // will do with async functions, but whatever it
    // does seems to work without warnings.
    makeAutoObservable(this);

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
    this.groups.setEnvironment(this);
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

  /**
   * The currently open group in the Student Work tab
   */
  get studentWorkTabSelectedGroupId() {
    const { ui, groups } = this;
    return ui.tabs.get("student-work")?.openSubTab
        || (groups.allGroups.length ? groups.allGroups[0].id : "");
  }

  /**
   * When we have a valid selectedGroupId,
   * Then set the active group (openSubTab) to be this group.
   * MobX `when` will only run one time, so this won't keep updating the openSubTab.
   * If the user somehow changes the openSubTab before all of the groups are loaded,
   * this will just set the openSubTab to be the same value it already is.
   */
  initializeStudentWorkTab() {
    // TODO: add a way to dispose the stores and then dispose this when if it is still
    // waiting
    when(
      () => this.studentWorkTabSelectedGroupId !== "",
      () => this.ui.setOpenSubTab("student-work", this.studentWorkTabSelectedGroupId)
    );
  }

  setTeacherGuide(guide: ProblemModelType | undefined) {
    this.teacherGuide = guide;
  }

  setAppMode(mode: AppMode) {
    this.appMode = mode;
  }

  // If we need to batch up the changes even more than currently,
  // we could try changing this to a MobX flow.
  // However typing the yield statements is difficult. Also flows
  // in MobX are slightly different than flows in MST, so there might
  // be some weird interactions with action tracking if we mix them.
  async setUnitAndProblem(unitId: string | undefined, problemOrdinal?: string) {
    const { appConfig } = this;
    let unitJson = await getUnitJson(unitId, appConfig);
    if (unitJson.status === 404) {
      unitJson = await getUnitJson(appConfig.defaultUnit, appConfig);
    }

    // read the unit content, but don't instantiate section contents (DocumentModels) yet
    const unit = createUnitWithoutContent(unitJson);

    const _problemOrdinal = problemOrdinal || appConfig.defaultProblemOrdinal;
    const { investigation: _investigation, problem: _problem } = unit.getProblem(_problemOrdinal);

    appConfig.setConfigs([unit.config || {}, _investigation?.config || {}, _problem?.config || {}]);

    // load/initialize the necessary tools
    const { authorTools = [], toolbar = [], tools: tileTypes = [] } = appConfig;
    const unitTileTypes = new Set(
      [...toolbar.map(button => button.id), ...authorTools.map(button => button.id), ...tileTypes]);
    await registerTileTypes([...unitTileTypes]);

    // We are changing our observable state here so we need to be in an action.
    // Because this is an async function, we'd have to switch it to a flow to
    // make the whole thing an action. However typing the yields in flows is
    // annoying, so instead we just run this non async part in an anonymous action.
    // Because appConfig.setConfigs is located before this block it will
    // not be batched with the rest of these updates. Having it not batched
    // should be fine and keeps things less complicated.
    runInAction(() => {
      // read the unit content with full contents now that we have tools
      this.unit = UnitModel.create(unitJson);
      const {investigation, problem} = this.unit.getProblem(_problemOrdinal);

      // TODO: make this dynamic like the way the components work. The components
      // access these values from the stores when they need them. This way the values
      // can be changed on the fly without having to track down each object that is
      // using them.
      this.documents.setAppConfig(appConfig);
      this.documents.setFirestore(this.db.firestore);
      this.documents.setUserContextProvider(this.userContextProvider);

      if (investigation && problem) {
        this.investigation = investigation;
        this.problem = problem;
      }
      this.ui.setProblemPath(this.problemPath);

      // Set the active tab to be the first tab
      const tabs = this.tabsToDisplay;
      if (tabs.length > 0) {
        this.ui.setActiveNavTab(tabs[0].tab);
      }
    });

    addDisposer(unit, when(() => {
        return this.user.isTeacher;
      },
      async () => {
        // Uncomment the next line to add a 5 second delay.
        // This is useful to test whether the teacher guide tab shows when there is a network delay.
        // await new Promise((resolve) => setTimeout(resolve, 5000));

        // only load the teacher guide content for teachers
        const guideJson = await getGuideJson(unitId, appConfig);
        if (guideJson.status !== 404) {
          const unitGuide = guideJson && UnitModel.create(guideJson);
          // Not sure if this should be "guide" or "teacher-guide", either ought to work
          unitGuide?.setFacet("teacher-guide");
          const teacherGuide = unitGuide?.getProblem(problemOrdinal || appConfig.defaultProblemOrdinal)?.problem;
          this.setTeacherGuide(teacherGuide);
        }
      }
    ));
  }
}
