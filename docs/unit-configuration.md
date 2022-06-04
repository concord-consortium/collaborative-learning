# Unit Configuration

## Top-level Unit Properties

```
    code: "",
    abbrevTitle: "",
    title: types.string,
    subtitle: "",
    sections: types.maybe(types.frozen<ISectionInfoMap>()),
    planningDocument: types.maybe(PlanningDocumentConfigModel),
    lookingAhead: types.maybe(DocumentContentModel),
    investigations: types.array(InvestigationModel),
    supports: types.array(SupportModel),
    config: types.maybe(types.frozen<Partial<UnitConfiguration>>())
```

## [Deprecated] Legacy Top-level Properties now in `config`

If any of these properties are encountered at the top-level of the unit configuration then the code assumes it is dealing with a legacy configuration and the contents of the `config` property are ignored.

```
    disabled: types.array(types.string),
    placeholderText: "",
    defaultStamps: types.array(StampModel), ==> renamed `stamps` within `config`
    settings: types.maybe(SettingsMstType),
    navTabs: types.maybe(NavTabsConfigModel),
```

## Unit-level `config` properties

These properties are configurable at the application (built into the code) or the unit level of the curriculum JSON.

```
  // used in application loading message, log messages, etc.
  appName: string;
  // displayed in browser tab/window title
  pageTitle: string;
  // used for demo creator links
  demoProblemTitle: string;
  // default problem to load if none specified
  defaultProblemOrdinal: string;
  // disable grouping of students (e.g. Dataflow)
  autoAssignStudentsToIndividualGroups: boolean;
  // type of user document to create/show by default
  defaultDocumentType: "problem" | "personal";
  // default title of personal documents (problem documents don't have user-assigned titles)
  defaultDocumentTitle: string;
  // following two properties used for displaying titles for documents
  docTimeStampPropertyName: string;
  docDisplayIdPropertyName: string;
  // default title of learning log documents
  defaultLearningLogTitle: string;
  // overrides `defaultLearningLogTitle`; not clear why both are required
  initialLearningLogTitle: string;
  // whether to create an initial/default learning log document for each user
  defaultLearningLogDocument: boolean;
  // whether to automatically divide problem documents into sections
  autoSectionProblemDocuments: boolean;
  // array of property names to use when constructing document labels
  documentLabelProperties: string[];
  // terminology for referencing documents
  documentLabels: Record<string, SnapshotIn<typeof DocumentLabelModel>>;
  // disables publishing documents of particular types or with particular properties
  disablePublish: Array<SnapshotIn<typeof DocumentSpecModel>> | boolean;
  // configures naming of copied documents
  copyPreferOriginTitle: boolean;
  // enable/disable dragging of tiles
  disableTileDrags: boolean;
  // show the class switcher menu for teachers
  showClassSwitcher: boolean;
  // whether to show one-up/two-up view icons in document title bar
  supportStackedTwoUpView: boolean;
  // whether to show published (non-editable) documents in the editing workspace
  showPublishedDocsInPrimaryWorkspace: boolean;
  // comparison view placeholder content
  comparisonPlaceholderContent: string | string[];
  // configuration of navigation tabs (document navigation UI)
  navTabs: SnapshotIn<typeof NavTabsConfigModel>;
```

## Unit- or Problem-level `config` properties

These properties are configurable at the unit, investigation, or problem levels of the curriculum JSON.

```
  disabledFeatures: string[];
  toolbar: SnapshotIn<typeof ToolbarModel>;
  // required tools that aren't in the toolbar can be specified here
  tools?: string[];
  defaultDocumentTemplate?: IAuthoredDocumentContent;
  placeholderText: string;
  stamps: SnapshotIn<typeof StampModel>[];
  settings: SnapshotIn<typeof SettingsMstType>;
```
