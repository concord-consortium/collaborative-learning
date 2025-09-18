import { addDisposer, clone, getSnapshot } from "mobx-state-tree";
import { makeAutoObservable, runInAction, when } from "mobx";
import { AppConfigModel, AppConfigModelType } from "./app-config-model";
import { UnitModel, UnitModelType } from "../curriculum/unit";
import { getGuideJson, getUnitJson } from "../curriculum/unit-utils";
import { InvestigationModel, InvestigationModelType } from "../curriculum/investigation";
import { ProblemModel, ProblemModelType } from "../curriculum/problem";
import { PersistentUIModel, PersistentUIModelType } from "./persistent-ui/persistent-ui";
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
import { AppMode, kDemoSiteStorageKey } from "./store-types";
import { SerialDevice } from "./serial";
import { IBaseStores, IGitInfo } from "./base-stores-types";
import { NavTabModelType } from "../view/nav-tabs";
import { Bookmarks } from "./bookmarks";
import { SortedDocuments } from "./sorted-documents";
import { removeLoadingMessage, showLoadingMessage } from "../../utilities/loading-utils";
import { problemLoaded } from "../../lib/misc";
import { CurriculumConfig, ICurriculumConfig } from "./curriculum-config";
import { urlParams } from "../../utilities/url-params";
import { createAndLoadExemplarDocs } from "./create-exemplar-docs";
import curriculumConfigJson from "../../clue/curriculum-config.json";
import { gImageMap } from "../image-map";
import { ExemplarControllerModel, ExemplarControllerModelType } from "./exemplar-controller";
import { SectionDocuments } from "./section-docs-store";
import { Portal } from "./portal";

export interface IStores extends IBaseStores {
  problemPath: string;
  problemOrdinal: string;
  userContextProvider: UserContextProvider;
  tabsToDisplay: NavTabModelType[];
  documentToDisplay?: string;
  documentHistoryId?: string;
  isShowingTeacherContent: boolean;
  isProblemLoaded: boolean;
  studentWorkTabSelectedGroupId: string | undefined;
  setAppMode: (appMode: AppMode) => void;
  initializeStudentWorkTab: () => void;
  loadUnitAndProblem: (unitId: string | undefined, problemOrdinal?: string) => Promise<void>;
  sortedDocuments: SortedDocuments;
  sectionDocuments: SectionDocuments;
  unitLoadedPromise: Promise<void>;
  sectionsLoadedPromise: Promise<void>;
  startedLoadingUnitAndProblem: boolean;
  exemplarController: ExemplarControllerModelType;
  portal: Portal;
  gitInfo: IGitInfo;
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
  bookmarks: Bookmarks;
  supports: SupportsModelType;
  clipboard: ClipboardModelType;
  selection: SelectionStoreModelType;
  serialDevice: SerialDevice;
  userContextProvider: UserContextProvider;
  sortedDocuments: SortedDocuments;
  sectionDocuments: SectionDocuments;
  unitLoadedPromise: Promise<void>;
  sectionsLoadedPromise: Promise<void>;
  startedLoadingUnitAndProblem: boolean;
  exemplarController: ExemplarControllerModelType;
  portal: Portal;

  constructor(params?: ICreateStores){
    // This will mark all properties as observable
    // all getters as computed, all setters as actions
    // and any other function's type will be determined
    // at runtime. It isn't clear from the docs what it
    // will do with async functions, but whatever it
    // does seems to work without warnings.
    makeAutoObservable(this);
    this.appMode = params?.appMode || "dev";
    this.appVersion = params?.appVersion || "unknown";
    this.gitInfo = params?.gitInfo || {};
    this.curriculumConfig = params?.curriculumConfig || CurriculumConfig.create(curriculumConfigJson, {urlParams});
    this.appConfig = params?.appConfig || AppConfigModel.create();

    // To keep the code simple, we create a null unit, investigation, and problem if
    // they aren't provided.
    // Code that needs the real unit should wait on the `unitLoadedPromise`.
    // If the unit is passed in, then the unitLoadedPromise will resolve immediately,
    // this only happens in tests.
    const defaultUnit = UnitModel.create({code: "NULL", title: "Null Unit"});
    this.unit = params?.unit || defaultUnit;
    this.investigation = params?.investigation ||
      InvestigationModel.create({ ordinal: 0, title: "Null Investigation" });
    this.problem = params?.problem || ProblemModel.create({ ordinal: 0, title: "Null Problem" });

    this.user = params?.user || UserModel.create({ id: "0" });

    // Groups need stores (this) as the MST environment.
    // The environment of an MST object can't be changed once created. So if we are passed a
    // groups object, we need to clone it so we can set the environment.
    // Any code that passes in a groups object needs to use the returned one instead of their
    // original.
    this.groups = params?.groups
      ? clone(params.groups, this)
      : GroupsModel.create({}, this);
    this.class = params?.class || ClassModel.create({ name: "Null Class", classHash: "" });
    this.db = params?.db || new DB();
    this.documents = params?.documents || createDocumentsModelWithRequiredDocuments(requiredDocumentTypes);
    this.networkDocuments = params?.networkDocuments || DocumentsModel.create({});
    const demoName = params?.demoName || window.localStorage.getItem(kDemoSiteStorageKey) || this.appConfig.appName;
    this.demo = params?.demo || DemoModel.create({name: demoName, class: {id: "0", name: "Null Class"}});
    this.showDemoCreator = params?.showDemoCreator || false;
    this.supports = params?.supports || SupportsModel.create({});
    this.clipboard = ClipboardModel.create();
    this.selection = SelectionStoreModel.create();
    this.serialDevice = new SerialDevice();
    this.ui = params?.ui || UIModel.create({
      learningLogWorkspace: {
        type: LearningLogWorkspace,
        mode: "1-up"
      },
    });
    this.persistentUI = params?.persistentUI || PersistentUIModel.create({
      problemWorkspace: {
        type: ProblemWorkspace,
        mode: "1-up"
      }
    });
    this.persistentUI.setProblemPath(this.problemPath);
    this.userContextProvider = new UserContextProvider(this);
    this.bookmarks = new Bookmarks({db: this.db});
    this.sortedDocuments = new SortedDocuments(this);
    this.sectionDocuments = new SectionDocuments(this);

    // If there is a `studentDocument` URL parameter, then tell the UI to display it
    const docToDisplay = params?.documentToDisplay;
    if (docToDisplay) {
      // Make sure there is a Sort Work tab to display the document in.
      this.appConfig.setRequireSortWorkTab(true);
      // Set request for viewing at the given history ID, if provided
      if (params.documentHistoryId) {
        this.sortedDocuments.setDocumentHistoryViewRequest(docToDisplay, params.documentHistoryId);
      }
      // Wait until the document is loaded, then open it.
      const docPromise = this.sortedDocuments.fetchFullDocument(docToDisplay);
      docPromise.then((doc) => {
        if (doc) {
          this.persistentUI.openResourceDocument(
            doc, this.appConfig, this.user, this.sortedDocuments,
            { fromUrlStudentDocument: true }
          );
        } else {
          console.warn("Display document not found: ", params.documentToDisplay);
        }
      });
    }

    this.unitLoadedPromise = when(() => this.unit !== defaultUnit);
    this.sectionsLoadedPromise = when(() => this.problem.sections.length > 0);
    this.exemplarController = ExemplarControllerModel.create();
    this.portal = new Portal();
  }

  get tabsToDisplay() {
    const { appConfig: { navTabs: navTabSpecs },
      teacherGuide,
      user: { isTeacherOrResearcher, standaloneAuth },
      ui: { standalone },
    } = this;

    const removeNonCurriculumTabs = standalone && standaloneAuth;

    const tabs = (isTeacherOrResearcher)
      ? navTabSpecs.tabSpecs.filter(t => (t.tab !== "teacher-guide") || teacherGuide)
      : navTabSpecs.tabSpecs.filter(t => !t.teacherOnly);

    return removeNonCurriculumTabs
      ? tabs.filter(t => t.tab === "problems" || t.tab === "teacher-guide")
      : tabs;
  }

  get isProblemLoaded() {
    return this.problem && this.problem.ordinal !== 0;
  }

  get problemPath() {
    return `${this.unit.code}/${this.investigation.ordinal}/${this.problem.ordinal}`;
  }

  get problemOrdinal() {
    const { investigation, problem } = this;
    return `${investigation.ordinal}.${problem.ordinal}`;
  }

  get isShowingTeacherContent() {
    const { persistentUI: { showTeacherContent }, user: { isTeacherOrResearcher } } = this;
    return isTeacherOrResearcher && showTeacherContent;
  }

  /**
   * The currently open group in the Student Work tab
   */
  get studentWorkTabSelectedGroupId() {
    const { persistentUI, groups } = this;
    return persistentUI.tabs.get("student-work")?.currentDocumentGroupId
        || (groups.nonEmptyGroups.length ? groups.nonEmptyGroups[0].id : "");
  }

  /**
   * When we have a valid selectedGroupId,
   * Then set the active group (openSubTab) to be this group.
   * MobX `when` will only run one time, so this won't keep updating the openSubTab.
   * If the user somehow changes the openSubTab before at least one group is loaded,
   * this will just set the openSubTab to be the same value it already is.
   */
  initializeStudentWorkTab() {
    // TODO: add a way to dispose the stores and then dispose this when if it is still
    // waiting
    when(
      () => this.studentWorkTabSelectedGroupId !== "",
      () => this.persistentUI.setCurrentDocumentGroupId("student-work", this.studentWorkTabSelectedGroupId)
    );
  }

  setTeacherGuide(guide: ProblemModelType | undefined) {
    this.teacherGuide = guide;
  }

  setAppMode(mode: AppMode) {
    this.appMode = mode;
  }

  setUnit(unit: UnitModelType) {
    this.unit = unit;
  }

  // If we need to batch up the changes even more than currently,
  // we could try changing this to a MobX flow.
  // However typing the yield statements is difficult. Also flows
  // in MobX are slightly different than flows in MST, so there might
  // be some weird interactions with action tracking if we mix them.
  async loadUnitAndProblem(unitId: string | undefined, problemOrdinal?: string) {
    const { appConfig, curriculumConfig, persistentUI } = this;
    this.startedLoadingUnitAndProblem = true;
    showLoadingMessage("Loading curriculum unit");
    const unitJson = await getUnitJson(unitId, curriculumConfig);
    if (unitJson.status === 404) {
      this.ui.setError(`Cannot load the curriculum unit: ${unitId}`);
      return;
    }
    removeLoadingMessage("Loading curriculum unit");
    showLoadingMessage("Setting up curriculum content");

    // Initialize the imageMap
    const unitUrls = curriculumConfig.getUnitSpec(unitId);
    unitUrls && gImageMap.setUnitUrl(unitUrls.content);
    gImageMap.setUnitCodeMap(getSnapshot(curriculumConfig.unitCodeMap));

    // read in the unit content (which does not instantiate the sections' contents)
    const unit = UnitModel.create(unitJson);

    const _problemOrdinal = problemOrdinal || appConfig.defaultProblemOrdinal;
    const { investigation, problem } = unit.getProblem(_problemOrdinal);

    appConfig.setConfigs([unit.config || {}, investigation?.config || {}, problem?.config || {}]);

    // load/initialize the necessary tools
    showLoadingMessage("Loading tile types");
    const { authorTools = [], toolbar = [], tools: tileTypes = [] } = appConfig;
    const unitTileTypes = new Set(
      [...toolbar.map(button => button.id), ...authorTools.map(button => button.id), ...tileTypes]);
    await registerTileTypes([...unitTileTypes]);
    removeLoadingMessage("Loading tile types");

    this.setUnit(unit);

    if (problem && unitUrls) {
      showLoadingMessage("Loading curriculum sections");
      problem.loadSections(unitUrls.content).then(() => {
        removeLoadingMessage("Loading curriculum sections");
      });
      showLoadingMessage("Loading exemplar documents");
      createAndLoadExemplarDocs({
        unit,
        unitUrl: unitUrls.content,
        investigation,
        problem,
        documents: this.documents,
        user: this.user,
        curriculumConfig,
        appConfig
      }).then(() => {
        removeLoadingMessage("Loading exemplar documents");
      });
    }

    // We are changing our observable state here so we need to be in an action.
    // Because this is an async function, we'd have to switch it to a flow to
    // make the whole thing an action. However typing the yields in flows is
    // annoying, so instead we just run this non async part in an anonymous action.
    // Because appConfig.setConfigs is located before this block it will
    // not be batched with the rest of these updates. Having it not batched
    // should be fine and keeps things less complicated.
    runInAction(() => {
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

      problemLoaded(this, _problemOrdinal);

      persistentUI.setProblemPath(this.problemPath);

      persistentUI.initializeActiveNavTab(this.tabsToDisplay);
      removeLoadingMessage("Setting up curriculum content");
    });

    addDisposer(this.unit, when(() => {
        return this.user.isTeacherOrResearcher;
      },
      async () => {
        // Uncomment the next line to add a 5 second delay.
        // This is useful to test whether the teacher guide tab shows when there is a network delay.
        // await new Promise((resolve) => setTimeout(resolve, 5000));

        // only load the teacher guide content for teachers
        const guideJson = await getGuideJson(unitId, curriculumConfig);
        if (guideJson.status !== 404) {
          const unitGuide = guideJson && UnitModel.create(guideJson);
          // Not sure if this should be "guide" or "teacher-guide", either ought to work
          unitGuide?.setFacet("teacher-guide");
          const teacherGuide = unitGuide?.getProblem(problemOrdinal || appConfig.defaultProblemOrdinal)?.problem;
          // There might not be a teacher guide for this specific problem
          if (!unitUrls?.guide || !teacherGuide) return;
          teacherGuide.loadSections(unitUrls.guide);
          this.setTeacherGuide(teacherGuide);
        }
      }
    ));
  }
}
