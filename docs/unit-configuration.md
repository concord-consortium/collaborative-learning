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

`appName`: (string) used in application loading message, log messages, etc.

`pageTitle`: (string) displayed in browser tab/window title

`demoProblemTitle`: (string) used for demo creator links

`defaultProblemOrdinal`: (string) default problem to load if none specified

`autoAssignStudentsToIndividualGroups`: (boolean) disable grouping of students (e.g. Dataflow)

`defaultDocumentType`: ("problem" | "personal") type of user document to create/show by default

`defaultDocumentTitle`: (string) default title of personal documents (problem documents don't have user-assigned titles)

`docTimeStampPropertyName`: (string) used for displaying titles for documents

`docDisplayIdPropertyName`: (string) used for displaying titles for documents

`defaultLearningLogTitle`: (string) default title of learning log documents

`initialLearningLogTitle`: (string) overrides `defaultLearningLogTitle`; not clear why both are required

`defaultLearningLogDocument`: (boolean) whether to create an initial/default learning log document for each user

`autoSectionProblemDocuments`: (boolean) whether to automatically divide problem documents into sections

`documentLabelProperties`: (string[]) array of property names to use when constructing document labels

`documentLabels`: (object) terminology for referencing documents

`disablePublish`: (boolean or array) disables publishing documents of particular types or with particular properties

`enableHistoryRoles`: (array of "student" | "teacher" | "researcher") enable/disable showing the history-scrubbing controls for users in different roles

`copyPreferOriginTitle`: (boolean) configures naming of copied documents

`disableTileDrags`: (boolean) enable/disable dragging of tiles

`showClassSwitcher`: (boolean) show the class switcher menu for teachers

`supportStackedTwoUpView`: (boolean) whether to show one-up/two-up view icons in document title bar

`showPublishedDocsInPrimaryWorkspace`: (boolean) whether to show published (non-editable) documents in the editing workspace

`comparisonPlaceholderContent`: (string | string[]) comparison view placeholder content

`initiallyHideExemplars`: (boolean) Whether exemplars are hidden from students by default, becoming visible based on conditions

`navTabs`: (object) configuration of navigation tabs (document navigation UI)

`annotations`: ("all" | "none" | string[]) List of the types of annotations supported (eg "curved-sparrow") or "all" or "none". Currently any value other than "none" will be treated as "all".

`enableCommentRoles`: (array of "student" | "teacher" | "researcher") list of roles that can use the comments panel

`showCommentTag`: (boolean) must be true for any of the comment-tag functionality to be enabled

`commentTags`: (object) list of possible values for tagging in comments, mapping IDs to human-readable names, eg: `{ "user": "Who is it for?", "environment": "Where is it used?", ... }`

`aiEvaluation`: ("custom" | "categorize-design" | "mock") If set, enable the specified AI evaluation to run after document updates. "custom" allows the prompt to be specified with the `aiPrompt` property; "categorize-design" runs the original MODS unit categorization prompt (for backward compatibility); "mock" does not invoke any AI system but simply returns a fixed string for testing purposes.

`aiPrompt`: (object) Configures the prompt to use for "custom" AI evaluation.  There are several properties wrapped up here, an example setting is below. "systemPrompt" and "mainPrompt" are required. The "categories", if supplied, must be a subset of "commentTags" (see above):

```json
"aiPrompt": {
  "systemPrompt": "You are a master teacher.",
  "mainPrompt": "This is a picture of a student document. Please evaluate and categorize it.",
  "categorizationDescription": "Categorize the document based on its content.",
  "categories": ["user", "environment", "form", "function"],
  "keyIndicatorsPrompt": "What are the key indicators that support this categorization?",
  "discussionPrompt": "Please provide any additional information."
}
```

`showIdeasButton`: (boolean | undefined) If set the ideas button visibility is determined by the value. If undefined the existing logic is used
which checks if the the aiEvaluation is set or if there are invisible exemplar documents.

`groupDocumentsEnabled`: (boolean | undefined) If true, group documents are enabled for the unit. If groups are not permitted (`autoAssignStudentsToIndividualGroups` is true), this setting has no effect.

`hide4up`: (boolean | undefined) If true, the button that switches to 4up view is always hidden.

`showShare`: (boolean | undefined) Whether the share/unshare toggle is shown on student documents (problem, personal, and learning log). Defaults to `true`. Set to `false` to hide sharing for the unit. Hiding the button does not unshare documents that are already shared.

`classWideDocuments`: (array | undefined) Class-wide collaborative documents for the unit. Each entry is `{ kind, title }` and becomes one auto-created, concurrently-edited document shared by the whole class, one per class per unit (e.g. a Driving Question Board). `kind` is a label so multiple class wide documents can be added. This label has to be unique across all document types not just class wide documents. It must be a camelCase identifier — a lowercase letter followed by letters or digits, with no spaces, hyphens, or other special characters (e.g. `drivingQuestionBoard`); entries with an invalid `kind` are ignored. `title` is the fixed document title. Units that omit this array create no class-wide documents.

## Unit- or Problem-level `config` properties

These properties are configurable at the unit, investigation, or problem levels of the curriculum JSON.

`chatTutorEnabled`: (boolean) If true, the AI chat tutor is enabled for students in this unit. The `chatTutor` URL param also enables it (so authors can preview it). Like other config this merges bottom-up (problem, then investigation, then unit), so a value set at a lower level overrides the unit's. Disabling preserves any `chatTutorPrompts` overrides.

`chatTutorIntro`: (string) Optional per-unit intro message shown at the top of the chat tutor column. Display-only — it is never sent to the AI as context. Unset falls back to the built-in default; an empty string suppresses the intro entirely.

`chatTutorPrompts`: (object) Optional per-unit AI chat tutor prompt overrides: `replaceGenericPrompt` swaps out the server's built-in generic tutor prompt; `appendToGenericPrompt` is added after the (possibly replaced) generic prompt.

`chatTutorProvider`: ("openai" | "foreverlearning") Which AI backend is selected for this unit's tutor turns. **Only `openai` is implemented — setting anything else does not currently change which AI answers.** The selection is carried end to end (it starts a separate conversation and is stamped on each message), but the server builds an OpenAI backend unconditionally, so a non-`openai` value takes effect only once a second backend is implemented. Unset uses `openai`, the default. The `chatProvider` URL param overrides this property so a single session can be flipped for testing without re-authoring; an unrecognized URL param value falls back to the unit config, and an unrecognized unit config value falls back to the default. Switching providers starts a fresh conversation rather than continuing the existing one, because a conversation's backend-specific state cannot transfer. `chatTutorPrompts` applies regardless of the selected provider — the prompt overrides are sent on the same messages either way, and editing them starts a fresh conversation as always. Not exposed in the authoring UI, so it is set in the curriculum JSON.

```typescript
  disabledFeatures: string[];
  toolbar: SnapshotIn<typeof ToolbarModel>;
  authorTools: SnapshotIn<typeof ToolbarModel>;
  // required tools that aren't in the toolbar can be specified here
  tools?: string[];
  defaultDocumentTemplate?: IAuthoredDocumentContent;
  planningTemplate?: Record<string, IAuthoredDocumentContent>;
  // text shown in "placeholder" tiles.
  // key is the container type, value is the text.
  // currently supported container types are "QuestionContent" for placeholder tiles inside Question tiles,
  // and "default" for placeholder tiles in other contexts.
  // Note that the "placeholder" property of sections will override the default placeholder text.
  placeholder?: Record<string, string>;
  // This is the placeholder content shown in Text tiles.
  placeholderText: string;
  stamps: SnapshotIn<typeof StampModel>[];
  // See next section for what can go in 'settings'
  settings: SnapshotIn<typeof SettingsMstType>;
  // Which panels are shown when a user FIRST visits a problem (first-time visitors only).
  // "split" (default) shows both; "workspace-only" collapses resources; "resources-only" collapses workspace.
  // Note this also determines the divider that `fixedStartView` forces, for every user rather than
  // just first-time visitors, and "workspace-only" turns `fixedStartView` off entirely (see below).
  defaultPanelLayout?: "split" | "workspace-only" | "resources-only";
  // How the split view divides its width. "evenLayout" (default) splits evenly; "wideContent" narrows
  // the resources pane (~1/3) so the workspace stays wide until comments are opened.
  contentLayout?: "evenLayout" | "wideContent";
  // When true, every user starts on `fixedStartTab` each load (that tab, no document open, divider reset
  // to the defaultPanelLayout position) instead of resuming where they left off. Applied as a session-only
  // override, so it never overwrites the user's saved place. It is released in three independent
  // parts: choosing a different top-level tab or opening a document hands back their own tab (and
  // sub tab), resizing the panel hands back their own divider, and choosing a sub tab hands back
  // their own sub tab. Moving between sub tabs does not release the tab, so a user who only browses
  // sub tabs stays on the forced tab for the session.
  // The forced tab shows its thumbnail browser for every sub tab, the Bookmarks sub tab included,
  // and opens on the FIRST sub tab rather than the one the user last used, so the published work is
  // actually what they land on. On the curriculum tabs ("problems", "teacher-guide") only the tab is
  // forced: they always show a section rather than a browser, so the section the user last read is
  // restored as usual.
  // Ignored (with a console warning) when `defaultPanelLayout` is "workspace-only", which collapses the
  // resources panel the forced tab lives in: there would be nothing to see, and forcing the collapsed
  // divider would close the panel on every load for a user who had opened it. Note the mirror case is
  // NOT refused: with "resources-only" the forced tab is visible, but the workspace is collapsed on
  // every load until the user resizes, not just on their first visit.
  // Clicking a sub tab adopts it as the user's own, including the first sub tab the forced view puts
  // them on, so a click there replaces the sub tab they had left off on.
  fixedStartView?: boolean;
  // The nav tab to start on when fixedStartView is true: an ENavTab id, e.g. "class-work" or "sort-work".
  // Must be a tab that is shown for the current user, or it is ignored with a console warning. Note a
  // teacher-only tab is therefore forced for teachers and ignored for students; the authoring form only
  // offers tabs that are shown and not teacher-only. Two tabs cannot be used at all:
  //   "student-work" is group keyed and always shows the four-up, so it has no "no document open"
  //     state to start in; it is refused outright.
  //   "teacher-guide" resolves too late. The start view is decided once the unit and the saved UI have
  //     loaded, but the guide is fetched on a separate path that finishes afterwards, so the tab is not
  //     yet in the displayed list and the start view is ignored with a console warning rather than
  //     being retried. Only hand-authored unit JSON can reach this; the authoring form filters
  //     teacher-only tabs out of the dropdown.
  // Kept separate from the switch so turning fixedStartView off preserves the chosen tab.
  fixedStartTab?: ENavTab;
```

### Settings properties

Settings is primarily concerned with configuring each tile type,
plus there is a section to configure dataset options.
Some settings are available for all tile types, others are specific to the tile.

All tile types that have been migrated to the common toolbar framework support a `tools` option, in which you can list the buttons that should appear on the tile toolbar, in order. You can also specify separators that are drawn between buttons in the toolbar by including the string `"|"` at the appropriate position(s) in the list.

#### Dataset

Under 'dataset', there is one option:

- `cellsSelectCases`: boolean

#### AI Tile

No toolbar.

- `systemPrompt`: the system prompt used in combination with the specific prompt of each AI tile.
Default: "You are a helpful, collaborative student."

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

Additional Live Output / sampling keys (all optional; each defaults to today's behavior):

- `servoInputMode`: `"degrees"` (default) or `"proportion"`. In `"proportion"` mode the Servo Live
  Output accepts an input from 0–1 instead of 0–180 degrees (mapping 0→0°, 1→180°) and its field reads
  `"<n>% rotation"`. The stored/hardware value stays in degrees, so the serial path is unchanged.
- `liveOutputTypes`: an array of Live Output type names to offer in the block's dropdown, e.g.
  `["Servo", "Gripper 2.0"]`. Absent, empty, unknown-only, or listing *every* type all mean the full
  list (no restriction, standard order). For a genuine subset the author's order is preserved and the
  first entry is the default for a new block. A block whose saved type is excluded still shows and keeps
  that type (it is not overwritten).
- `defaultSamplingRate`: the sampling rate (ms) seeded into a **newly created** Dataflow tile — one of
  `50`, `100`, `500`, `1000` (default), `10000`, `60000`. It never overwrites a tile's saved rate.

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
- `upload`
- `text`
- `stroke-color`
- `fill-color`
- `duplicate`
- `rotate-right`
- `flip-horizontal`
- `flip-vertical`
- `group`
- `ungroup`
- `zoom-in`
- `zoom-out`
- `fit-all`
- `navigator`
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

#### IframeInteractive

- `maxTiles`: number
- `url`: string (URL for the embedded interactive)
- `interactiveState`: object (default interactive state)
- `authoredState`: object (default authored state for curriculum configuration)
- `allowedPermissions`: string (iframe permissions policy)
- `maxHeight`: number (max height in pixels, 0 for unlimited)
- `enableScroll`: boolean

(no toolbar)

#### Simulation

- `defaultSimulation`: string
- `maxTiles`: int

(no toolbar)

#### Table

- `numFormat`: string (A D3 format specification)

Common toolbar framework; default toolbar buttons:

- `import-data`
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
- `highlight`
- `subscript`
- `superscript`
- `heading`
- `list-ol`
- `list-ul`
- `link`
- `voice-typing`

Additionally these buttons are supported and can be added to the toolbar if the configuration makes use of shared variables:

- `new-variable`
- `insert-variable`
- `edit-variable`

#### Wave Runner

Common toolbar framework; default buttons:

- `load-data`
- `play`
- `restart`
- `reset`
- `timeline`

Additional settings:

- `stations`: array of station objects, each with `network`, `station`, `channel`, and `label` properties. These define the seismograph stations available in the station picker dropdown.
- `defaultStation`: index into the `stations` array specifying which station is selected by default.

## Problem Sections

There are 2 active parts of the unit configuration involved in the definition of problem sections:
- `/sections`
- `/investigations[]/problems[]/sections`

There is a third part that is no longer used:
- `/config/navTabs/tabSpecs[tab = "problems"]/sections`

`/investigations[]/problems[]/sections` can either have inline problem section content or it can be a URL to the section content stored in a different file. This array of sections determines the sub tabs shown within the problem tab. When `autoSectionProblemDocuments` is enabled, the array of sections in `/investigations[]/problems[]/sections` is used to add headers and placeholders to the default document seen by the student when they first open the document.

In the `/sections` map the key is the "type" of the section. This type can can be any string the author wants. In `/investigations[]/problems[]/sections` the content has a `type` field that must match one keys in the `/sections` map. The title used for the section sub tab within the problem tab is taken from the title defined in the matching `/sections` item. The title and initials of the from the entry in `/sections` is used in the header created by `autoSectionProblemDocuments`.

The type values are also used to identify the problem section in the navigation system. So when CLUE records which tab the user is looking at (PersistentUI) it uses a path ending with this type value. Because of this there should not be multiple sections in a problem's `/investigations[]/problems[]/sections` that have the same type.

`/config/navTabs/tabSpecs[tab = "problems"]/sections` has not been used at runtime for a while now. It was used by authoring system until Dec. 2025. The authoring system now removes this property from the unit when an author updates the "Curriculum Tabs" form. At some point we ought remove this vestigial property from all of the units.

### Authoring

For authoring we need a list of section types that can be used for problems sections. We also need to ensure these sections are not duplicated. Originally the plan was to provide unit wide list of sections that was ordered. And then in each problem the author could enable or disable these unit wide sections without being able to re-order them. This prevents authors from adding duplicate sections. However it doesn't match the runtime's support for different orders of sections within each problem.

What we probably need is a way for users to add sections to a problem and set their type. And then when they save this form a validation can prevent them from saving it with a duplicate section type. As long as the only way to set the section type is at the problem level configuration, then the validation can make sure it is unique.
