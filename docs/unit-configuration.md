# Unit Configuration

## Top-level Unit Properties

```typescript
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

```typescript
    disabled: types.array(types.string),
    placeholderText: "",
    defaultStamps: types.array(StampModel), ==> renamed `stamps` within `config`
    settings: types.maybe(SettingsMstType),
    navTabs: types.maybe(NavTabsConfigModel),
```

## Unit-level `config` properties

These properties are configurable at the application (built into the code) or the unit level of the curriculum JSON.

```typescript
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
  // enable/disable showing the history-scrubbing controls for users in different roles
  enableHistoryRoles: Array<"student" | "teacher">;
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
  // Whether exemplars are hidden from students by default, becoming visible based on conditions
  initiallyHideExemplars: boolean;
  // configuration of navigation tabs (document navigation UI)
  navTabs: SnapshotIn<typeof NavTabsConfigModel>;
  // used for AI tagging
  showCommentTag?: boolean;
  tagPrompt?: string;
  commentTags?: Record<string, string>;
  // List of the types of annotations supported (eg "curved-sparrow") or "all" or "none"
  // Currently any value other than "none" will be treated as "all".
  annotations?: "all" | "none" | string[];
```

## Unit- or Problem-level `config` properties

These properties are configurable at the unit, investigation, or problem levels of the curriculum JSON.

```typescript
  disabledFeatures: string[];
  toolbar: SnapshotIn<typeof ToolbarModel>;
  // required tools that aren't in the toolbar can be specified here
  tools?: string[];
  defaultDocumentTemplate?: IAuthoredDocumentContent;
  placeholderText: string;
  stamps: SnapshotIn<typeof StampModel>[];
  // See next section for what can go in 'settings'
  settings: SnapshotIn<typeof SettingsMstType>;
```

### Settings properties

Settings is primarily concerned with configuring each tile type,
plus there is a section to configure dataset options.
Some settings are available for all tile types, others are specific to the tile.

All tile types that have been migrated to the common toolbar framework support a `tools` option, in which you can list the buttons that should appear on the tile toolbar, in order. You can also specify separators that are drawn between buttons in the toolbar by including the string `"|"` at the appropriate position(s) in the list.

#### Dataset

Under 'dataset', there is one option:

- `cellsSelectCases`: boolean

#### Bar Graph

Common toolbar framework.  One default button:

- `link-tile`: bring up the linking dialog to connect/disconnect a dataset

#### Data Deck

Not updated to common toolbar framework. However, supports toolbar configuration in a similar manner. Default buttons:
`["duplicate", "link-tile", "link-graph", "merge-in",
  ["data-set-view", "Table"], "image-upload", "delete-attribute"]`

#### Dataflow

Common toolbar framework.  Supports:

- `data-set-view`: Immediate creation of a linked tile.
- `data-set-link`: Bring up a dialog to choose a tile to link to (or create a new one)

Defaults:

- `["data-set-view", "Table"]`
- `["data-set-link", "Graph"]`

#### Diagram

- `maxTiles`: number

Common toolbar framework. Supports and defaults to the following toolbar buttons:

- `new-variable`
- `insert-variable`
- `edit-variable`
- `zoom-in`
- `zoom-out`
- `fit-view`
- `toggle-lock`
- `toggle-navigator`
- `["variables-link", "Graph"]`
- `delete`

#### Drawing

Uses common toolbar framework. Default buttons:

- `select`
- `line`
- `vector`
- `rectangle`
- `ellipse`
- `stamp`
- `stroke-color`
- `fill-color`
- `text`
- `upload`
- `group`
- `ungroup`
- `duplicate`
- `zoom-in`
- `zoom-out`
- `fit-all`
- `delete`

In addition, if shared variables are configured in unit, it supports additional buttons:

- `new-variable`
- `insert-variable`
- `edit-variable`

#### Expression

(Custom toolbar implementation?)

#### Geometry (Coordinate Grid)

Common toolbar framework. Default buttons:

- `select`: mode for selecting and moving objects
- `point`: mode for creating points
- `polygon`: mode for creating polygons
- `upload`: allows uploading an image to display in the background
- `duplicate`: copies the currently selected objects
- `label`: opens dialog to choose the type of label for selected object
- `add-data`: link or unlink from a dataset
- `delete`: delete the currently selected objects

Available buttons not in default set:

- `comment`: adds a text callout to the currently selected object
- `movable-line`: creates a line that can be positioned

#### Graph

- `autoAssignAttributes`: boolean, default true. When true, when a dataset is connected to the graph, its first two columns will be immediately assigned to the "x" and "y" axes of the graph.
- `connectPointsByDefault`: boolean, default true. When true connecting lines between data points are drawn.
- `defaultAxisLabels`: { "bottom": "x", "left": "y" }, default none
- `defaultSeriesLegend`: boolean, default true. When true, the graph can connect to and display multiple datasets, and includes a legend area which allows adding, modifying, and removing these layers.
- `disableAttributeDnD`: boolean, default true. When true, you cannot drop attributes onto the axes to change the graph.  "false" setting not currently tested.
- `emptyPlotIsNumeric`: boolean, default true. When true graph defaults to numeric axes. "false" setting not currently tested.
- `scalePlotOnValueChange`: boolean, default true. When true, adding/deleting/modifying value of any data causes the graph to be rescaled to fit the data.

Uses the common toolbar framework. Default toolbar buttons:

- `link-tile` (opens dialog to replace dataset with a new one)
- `add-points-by-hand` (creates a dataset owned by the graph)
- `fit-all` (rescale axes to fit all points in view)
- `toggle-lock` (lock axes so they won't automatically rescale)
- `movable-line` (show/hide the movable line)
- `move-points` (mode where points can be moved)
- `add-points` (mode where points can be added)

Additional buttons available not in default set:

- `link-tile-multiple` (opens dialog to add an additional dataset or link variables)

#### Image

Not updated to common toolbar framework and does not support toolbar configuration.

#### Numberline

Common toolbar framework; default toolbar buttons:

- `select` - selected by default - can't create points, only move filled or open points.
- `point` - create a filled point by clicking on the numberline.
- `point-open` - create an open point by clicking on the numberline. `select`, `point`, `point-open` are mutually exclusive
- `reset` - clear all points from the numberline
- `delete` - delete selected point(s) from the numberline

#### Simulation

- `defaultSimulation`: string
- `maxTiles`: int

(no toolbar)

#### Table

- `numFormat`: string (A D3 format specification)

Common toolbar framework; default toolbar buttons:

- `set-expression`
- `link-tile`
- `link-graph`
- `merge-in`
- `["data-set-view", "DataCard"]`
- `delete`

#### Text

Common toolbar framework; default buttons:

- `bold`
- `italic`
- `underline`
- `subscript`
- `superscript`
- `list-ol`
- `list-ul`
- `link`

Additionally these buttons are supported and can be added to the toolbar if the configuration makes use of shared variables:

- `new-variable`
- `insert-variable`
- `edit-variable`
