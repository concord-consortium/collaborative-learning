import { types, Instance, applySnapshot, getSnapshot, addDisposer, SnapshotIn, getType } from "mobx-state-tree";
import { observable, reaction } from "mobx";
import { cloneDeep} from "lodash";
import stringify from "json-stringify-pretty-compact";

import { Transform } from "rete-area-plugin/_types/area";

import { DataflowProgramModel, DataflowProgramModelType } from "./dataflow-program-model";
import { DEFAULT_DATA_RATE, ProgramDataRates } from "./utilities/node";
import { SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import { isInputVariable, isOutputVariable } from "../../shared-variables/simulations/simulation-utilities";
import { IDefaultContentOptions, ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { TileContentModel } from "../../../models/tiles/tile-content";
import {
  SharedDataSet, kSharedDataSetType, SharedDataSetType,
} from "../../../models/shared/shared-data-set";
import { updateSharedDataSetColors } from "../../../models/shared/shared-data-set-colors";
import { SharedModelType } from "../../../models/shared/shared-model";
import { DataSet, IDataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { SharedProgramData, SharedProgramDataType } from "../../shared-program-data/shared-program-data";

import { uniqueId } from "../../../utilities/js-utils";
import { getTileContentById, getTileModelById } from "../../../utilities/mst-utils";
import { kTableTileType } from "../../../models/tiles/table/table-content";
import { withoutUndo } from "../../../models/history/without-undo";
import { IDataflowOutputConfig } from "../../../../shared/ai-summarizer/ai-summarizer-types";
import { getTileModel } from "../../../models/tiles/tile-model";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { NodeChannelInfo } from "./utilities/channel";
import { simulatedChannelId } from "./utilities/simulated-channel";
import { simulatedHubName } from "./utilities/simulated-output";

export const kDataflowTileType = "Dataflow";

export function defaultDataflowContent(options?: IDefaultContentOptions): DataflowContentModelType {
  // Unit-config (settings.dataflow.defaultSamplingRate): seed a new tile's sampling rate from the unit.
  // Applied only at creation (never overwrites a saved rate); an unknown value falls back to the default.
  const configuredRate = options?.appConfig?.getSetting("defaultSamplingRate", "dataflow");
  const isKnownRate = ProgramDataRates.some(r => r.val === configuredRate);
  if (configuredRate != null && !isKnownRate) {
    console.warn(`settings.dataflow.defaultSamplingRate: ignoring unknown value ${JSON.stringify(configuredRate)}; ` +
      `expected one of ${ProgramDataRates.map(r => r.val).join(", ")}.`);
  }
  const programDataRate = isKnownRate ? configuredRate as number : DEFAULT_DATA_RATE;
  return DataflowContentModel.create({ programDataRate });
}

export const kDataflowDefaultHeight = 480;
export const kDefaultLabel = "Dataflow Node";

// This is an arbitrary limit on how many values can be recorded in a dataset.
// The intention is to keep the size of the dataset manageable.
// A case has one value for time and one value for each node
const kMaxRecordedValues = 10000;

const kPointAttributeName = "Point";

/** Each capture column paired with the node it came from.
 *
 * Paired by POSITION, the same rule recordCase writes by: prepareCapture lays the columns out as
 * the point number followed by one per node in program order, and recordCase writes node `i` into
 * column `i + 1`. One pairing rule for both, so if it is ever wrong it is wrong in the same,
 * visible way.
 *
 * Not by the `<uniqueId>*<nodeId>` that addNewAttrFromNode embeds in a column's id: copying a
 * tile remaps every attribute id through getUpdatedSharedDataSetIds, which is by design in CLUE
 * and drops the node id -- so an id-based pairing would silently stop working on any copy.
 */
function captureColumnsWithNodes(dataSet: IDataSet, program: DataflowProgramModelType) {
  const nodes = Array.from(program.nodes.values());
  return nodes.flatMap((node, i) => {
    const attr = dataSet.attributes[i + 1];   // + 1 skips the point column
    return attr ? [{ attr, node }] : [];
  });
}

/** `13:12:21`. Built by hand rather than with toLocaleTimeString: stripCaptureTime has to
 * recognize this exact shape again, and under a locale that punctuates time differently it would
 * stop matching and stamps would stack up. */
function formatCaptureTime(at: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`;
}

/** `Program 1 13:12:21` -> `Program 1`. */
function stripCaptureTime(name?: string) {
  return name?.replace(/ \d{2}:\d{2}:\d{2}$/, "") ?? "";
}

/** `Program 1 13:12:21`: the program's own name with the capture's start time appended.
 *
 * It becomes the dataset's name, which both DataflowContentModel.contentTitle and
 * TableContentModel.contentTitle surface -- so program and capture carry one name, renaming either
 * renames both, and the stamp doubles as the sign that this program has been recorded. The time is
 * recorded once, for the capture, rather than in a column on every row.
 *
 * Derived from the stripped base so a second capture replaces the stamp instead of appending
 * another one.
 */
function captureName(currentName: string | undefined, startedAt: Date) {
  return `${stripCaptureTime(currentName)} ${formatCaptureTime(startedAt)}`.trim();
}

export function defaultDataSet(title: string|undefined) {
  const dataSet = DataSet.create({
    name: title,
    attributes: [ { name: "x"}, { name: "y"} ]
  });
  return dataSet;
}

const ProgramZoom = types.model({
  dx: types.number,
  dy: types.number,
  scale: types.number,
})
.actions(self => ({
  update(transform: Transform) {
    const { x, y, k} = transform;
    self.dx = x;
    self.dy = y;
    self.scale = k;
  }
}));
export type ProgramZoomType = typeof ProgramZoom.Type;
export const DEFAULT_PROGRAM_ZOOM = { dx: 0, dy: 0, scale: 1 };

export type PanDirection = "up" | "down" | "left" | "right";

// Resolved per-unit Live Output config, mirrored onto the tile content (see the `outputConfig` prop).
// The type is shared with the AI summarizer (which can't import from src/plugins) — see ai-summarizer-types.
export type { IDataflowOutputConfig };

export const DataflowContentModel = TileContentModel
  .named("DataflowTool")
  .props({
    type: types.optional(types.literal(kDataflowTileType), kDataflowTileType),
    program: types.optional(DataflowProgramModel, getSnapshot(DataflowProgramModel.create())),
    programDataRate: DEFAULT_DATA_RATE,
    /** Whether a continuous recording produced this tile's data.
     *
     * The Ready/Recording/Done mode used to be derived from "the dataset has any cases", which
     * made a single sample flip the tile into Done: playback shown, program read-only, the record
     * button offering Clear. Samples are not a recording and must not do that.
     *
     * types.maybe rather than a defaulted boolean, so a document saved before this existed reads
     * as undefined and falls back to the old meaning -- a saved recording still opens in Done. */
    recordedRun: types.maybe(types.boolean),
    /**
     * @deprecated Nothing reads or writes this. The canvas now fits all content on every load
     * instead of restoring a saved pan/zoom, so the live transform lives in the volatile
     * `liveProgramZoom` below.
     *
     * It is retained purely so that history playback still works on documents saved before that
     * change. Panning used to call `setProgramZoom`, which recorded patches against nested paths
     * like `/programZoom/dx`; if the property is absent those paths no longer resolve, MST throws,
     * and `TreeManager` halts playback at that entry with a failure banner rather than skipping it.
     *
     * Removing it needs either a major version with a patch migration, or for history replay to
     * tolerate paths that reference removed properties.
     */
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
    // Resolved unit output config (settings.dataflow.*), mirrored here so the snapshot-only AI tile
    // summarizer — shared by the chat tutor and the functions-v2 aiEvaluation — can describe the
    // block's setup to the AI. Populated from appConfig when the tile is editable; absent when default.
    outputConfig: types.maybe(types.frozen<IDataflowOutputConfig>()),
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    emptyDataSet: DataSet.create(),
    channels: observable([]) as NodeChannelInfo[],
    // Volatile (not persisted): the canvas fits all content on every load rather than restoring a
    // saved pan/zoom, so this only tracks the live transform for the current session.
    liveProgramZoom: ProgramZoom.create(DEFAULT_PROGRAM_ZOOM),
    // Whether the toolbar's pan palette is showing (drawing's openPallette pattern).
    panPaletteOpen: false,
    // The toolbar pan button's face shows and re-performs the last direction chosen from the palette.
    lastPanDirection: "right" as PanDirection,
    // Whether this tile's program has blocks that only work with a connected device. Kept current
    // by the tile's ReteManager while the tile is editable.
    needsDevice: false,
    // Whether this tile's program needed a device, with none connected, when it opened. Set once by
    // the editable tile's ReteManager, never by later edits or connection changes; the connect
    // tutorial reads it.
    showConnectTutorialOnOpen: false,
    // Whether the toolbar's connect pane is showing.
    connectPaneOpen: false,
    // The message for this tile's most recent connection attempt, if it failed. Cleared when the
    // tile starts another attempt or disconnects, or when any device connects; the connect pane
    // shows it while nothing is connected.
    connectError: undefined as string | undefined,
    // True when a connection failed while the pane was closed; opening the pane clears it.
    unseenConnectError: false
  }))
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedModel = sharedModelManager?.getTileSharedModelsByType(self, SharedDataSet)?.[0];
      if (!firstSharedModel) return undefined;
      return firstSharedModel as SharedDataSetType;
    },
    get sharedVariables() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedVariables = sharedModelManager?.getTileSharedModelsByType(self, SharedVariables)?.[0];
      if (!firstSharedVariables) return undefined;
      return firstSharedVariables as SharedVariablesType;
    },
    get sharedProgramData() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedProgramData = sharedModelManager?.getTileSharedModelsByType(self, SharedProgramData)?.[0];
      if (!firstSharedProgramData) return undefined;
      return firstSharedProgramData as SharedProgramDataType;
    },
    get maxRecordableCases() {
      const numNodes = self.program.nodes.size;
      // The `+ 1` is for time which is recorded as the first value of each case
      return (kMaxRecordedValues/(numNodes + 1));
    },
  }))
  .views(self => ({
    get inputVariables() {
      const variables = self.sharedVariables?.variables;
      return variables?.filter(variable => isInputVariable(variable));
    },
    get outputVariables() {
      const variables = self.sharedVariables?.variables;
      return variables?.filter(variable => isOutputVariable(variable));
    },
    get dataSet(){
      return self.sharedModel?.dataSet || self.emptyDataSet;
    },

    get linkedDataSets(): SharedDataSetType[] {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const foundSharedModels = sharedModelManager?.isReady
        ? sharedModelManager.getTileSharedModels(self) as SharedDataSetType[]
        : [];
      return foundSharedModels;
    }
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      // Strip the transient per-tick buffers: a running program rewrites them every tick, which
      // would re-serialize the export each tick and continuously reload authoring previews. They
      // aren't curriculum content. Student saves use getSnapshot (not exportJson), so tick history
      // there is unaffected.
      const nodes = Object.fromEntries(
        Object.entries(snapshot.program.nodes).map(([id, node]) => {
          const n = node as any;
          return [id, { ...n, data: { ...n.data, tickEntries: {} } }];
        })
      );
      const program = { ...snapshot.program, recentTicks: [], nodes };
      if (options?.forHash) {
        // We only need the program for hashing
        return stringify({program}, {maxLength: 120});
      }
      // outputConfig mirrors unit config only to reach the runtime AI summarizer; keep it out of
      // exported curriculum JSON (the node reads appConfig live, so exports must not bake it in).
      const exported = {...snapshot, program};
      delete (exported as { outputConfig?: unknown }).outputConfig;
      return stringify(exported, {maxLength: 120});
    },
    /** Falls back to the row count for a document saved before `recordedRun` existed. */
    get hasRecordedRun(): boolean {
      return self.recordedRun ?? self.dataSet.cases.length > 0;
    },
    /** True when the columns already describe the current program: the point column followed by one
     * per named node, in order.
     *
     * prepareCapture rebuilds the columns from scratch, and every rebuild mints new attribute ids.
     * A linked table holds those ids, so rebuilding under one empties it -- the table keeps
     * rendering columns the dataset no longer has ("No attribute found for ID"). Table It prepares
     * the capture and so does the start of a recording, so this is the difference between the two
     * being one preparation and being a capture that loses its table.
     */
    get isCapturePrepared(): boolean {
      const expected = [kPointAttributeName, ...Array.from(self.program.nodes.values())
        .map(n => n.data.orderedDisplayName).filter(Boolean)];
      const actual = self.dataSet.attributes.map(a => a.name);
      return actual.length === expected.length && actual.every((name, i) => name === expected[i]);
    },
    get isDataSetEmptyCases(){
      //Used when DF linked to a table, then we clear. Different than isEmpty
      //Since there are two attributes X|Y for the default table, we only want to check if there are no cases
      return self.dataSet.cases.length === 0;
    },
    get isLinked(){
      return self.linkedDataSets.length > 0;
    },
    isLinkedToTile(tileId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const isTileIdFound = self.linkedDataSets.some(link => { //link is the shared model
        return sharedModelManager?.getSharedModelTileIds(link).includes(tileId);
      });
      return isTileIdFound;
    },
    /** The Table tile currently sharing this program's dataset, if any. Both Table It and Record
     * Single Sample key off this: one to avoid making a second table, the other to know whether
     * it has to make the first one. */
    get linkedTableTileId(): string | undefined {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = self.sharedModel;
      if (!sharedModelManager?.isReady || !sharedModel) return undefined;
      return sharedModelManager.getSharedModelTileIds(sharedModel)
        .find(id => getTileModelById(self, id)?.content.type === kTableTileType);
    },
    /** Elapsed seconds at a recorded row, derived from its position and the data rate rather than
     * read from the table -- the first column holds a point ordinal now. For a recording saved
     * before that change this returns what that column already held, since it was written as
     * index * rate / 1000. */
    getTimeAtRecordedIndex(index: number) {
      const { dataSet } = self;
      if (!dataSet || index < 0 || index >= dataSet.cases.length) {
        return 0;
      }
      return (index * self.programDataRate) / 1000;
    },
  }))
  .views(self => ({
    get durationOfRecording() {
      const { dataSet } = self;
      if (!dataSet) {
        return 0;
      }
      const lastIndex = dataSet.cases.length - 1;
      return self.getTimeAtRecordedIndex(lastIndex);
    }
  }))
  .views(self => ({
    get durationOfRecordingFormatted() {
      return formatTime(self.durationOfRecording);
    }
  }))
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.dataSet.name;
    },
    get annotatableObjects(): IClueTileObject[] {
      return [...self.program.nodes.values()].map(node => ({
        objectId: node.id,
        objectType: "Node",
      }));
    },
    // Only Sensor and Live Output nodes bind to a variable, and both do it via a derived string
    // rather than the variable id. simulatedChannelId/simulatedHubName are the single definition
    // of those strings — always go through them rather than rebuilding "SIM"/"Simulated " inline.
    // Deliberately simulatedChannelId, not simulatedChannel: the latter builds a full
    // NodeChannelInfo (computedValue, computedUnit, getType("sensor")), which changes every
    // simulation tick and would invalidate this computed once per tick while a highlight is
    // active. simulatedChannelId reads only variable.name, which is stable.
    getObjectsForVariable(variableId: string): IClueTileObject[] {
      const variable = self.sharedVariables?.getVariableById(variableId);
      if (!variable) return [];
      const channelId = simulatedChannelId(variable);
      const hubName = simulatedHubName(variable);
      return [...self.program.nodes.values()]
        .filter(node => {
          const data = node.data as any;
          return (data.type === "Sensor" && data.sensor === channelId)
            || (data.type === "Live Output" && data.hubSelect === hubName);
        })
        .map(node => ({ objectId: node.id, objectType: "Node" }));
    },
  }))
  .actions(self => tileContentAPIActions({
    doPostCreate(metadata: ITileMetadataModel) {
      self.metadata = metadata;
    },
    setContentTitle(title: string) {
      self.dataSet.setName(title);
    }
  }))
  .actions(self => ({
    /**
     * Keeps a capture's column headers and its nodes' names the same, in both directions: renaming
     * a node renames its column, and renaming a column renames its node. One name, so there is no
     * conflict to arbitrate and no stale header after a rename -- which matters because a rename
     * deliberately does not detach, the columns still describing the program.
     *
     * Both directions are idempotent, writing only when the two differ, so the pair converges
     * after one round trip rather than looping.
     *
     * withoutUndo because this is derived, not an edit of its own: undoing a rename puts the
     * original name back and the other side simply follows, instead of needing a second undo and
     * leaving the two out of step in between.
     */
    syncColumnNamesFromNodes() {
      withoutUndo();
      captureColumnsWithNodes(self.dataSet, self.program).forEach(({ attr, node }) => {
        const nodeName = node.data.orderedDisplayName;
        if (nodeName && attr.name !== nodeName) self.dataSet.setAttributeName(attr.id, nodeName);
      });
    },
    syncNodeNamesFromColumns() {
      withoutUndo();
      captureColumnsWithNodes(self.dataSet, self.program).forEach(({ attr, node }) => {
        if (attr.name && node.data.orderedDisplayName !== attr.name) {
          node.data.setOrderedDisplayName(attr.name);
        }
      });
    },
    detachLinkedTables() {
      // Never reattached by undo, deliberately. A recorded capture describes the program as it
      // was, so re-linking it to a program that has moved on would reintroduce exactly the
      // results/program mismatch this exists to prevent. Keeping it off the undo stack is also
      // what avoids Tree.handleSharedModelChanges resolving `<sharedModelPath>/sharedModel` for
      // an entry an undo patch has removed, which throws "Not a child".
      //
      // This works only because the call comes from a reaction, not from inside the structural
      // action: withoutUndo is ignored (with a warning) when called from a child action.
      withoutUndo();
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const sharedModel = self.sharedModel;
      if (!sharedModelManager?.isReady || !sharedModel) return;
      // Nothing captured yet means nothing to preserve, and detaching would only break a link the
      // student is still setting up.
      if (self.dataSet.cases.length === 0) return;
      const followers = sharedModelManager.getSharedModelTileIds(sharedModel)
        .filter(id => id !== self.metadata.id);
      if (followers.length === 0) {
        // Nothing is showing the capture -- the student deleted the table -- so there is nobody to
        // hand it to. It is still stale, though, and leaving the rows in place would have the next
        // capture reuse columns built for the old program: recordCase writes by position, so a
        // deleted node silently shifts every value one column left. Clearing it makes the next
        // Table It or sample rebuild the columns.
        self.dataSet.removeCases(self.dataSet.cases.map(({ __id__ }) => __id__));
        self.dataSet.setName(stripCaptureTime(self.dataSet.name));
        return;
      }

      // The program walks away from the capture rather than copying it out: the tables keep the
      // dataset they already hold, with the student's numbers intact, and afterAttach's
      // sharedModelSetup reaction gives this program a fresh one.
      //
      // The tables also keep the stamped name as their record of when that capture ran, while the
      // program drops the stamp -- it has no recording any more. sharedModelSetup names the
      // replacement dataset from the tile's own title, so handing the base name back that way is
      // all this takes.
      getTileModel(self)?.setTitle(stripCaptureTime(self.dataSet.name));
      sharedModelManager.removeTileSharedModel(self, sharedModel);
    },
  }))
  .actions(self => ({
    afterAttach() { //
      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;
        const sharedDataSet = sharedModelManager?.isReady
          ? sharedModelManager?.findFirstSharedModelByType(SharedDataSet, self.metadata.id)
          : undefined;

        const sharedVariables = sharedModelManager?.isReady
          ? sharedModelManager?.findFirstSharedModelByType(SharedVariables)
          : undefined;

        const tileSharedModels = sharedModelManager?.isReady
          ? sharedModelManager?.getTileSharedModels(self)
          : undefined;

        const ourSharedProgramData = tileSharedModels?.find( sharedModel => {
          return getType(sharedModel) === SharedProgramData;
        });

        return { sharedModelManager, sharedDataSet, sharedVariables, tileSharedModels, ourSharedProgramData };
      },
      ({sharedModelManager, sharedDataSet, sharedVariables, tileSharedModels, ourSharedProgramData}) => {
        if (!sharedModelManager?.isReady) {
          return;
        }

        if (!sharedDataSet) {
          const tileModel = getTileModel(self);
          const dataSet = defaultDataSet(tileModel?.title);
          sharedDataSet = SharedDataSet.create({ providerId: self.metadata.id, dataSet });
          tileModel?.setTitle(undefined);
        }

        if (!tileSharedModels?.includes(sharedDataSet)) {
          sharedModelManager.addTileSharedModel(self, sharedDataSet);
        }

        // We won't create a sharedVariables model, but we'll automatically attach to any we find
        if (sharedVariables && !tileSharedModels?.includes(sharedVariables)) {
          sharedModelManager.addTileSharedModel(self, sharedVariables);
        }

        if (!ourSharedProgramData) {
          const programData = SharedProgramData.create();
          sharedModelManager.addTileSharedModel(self, programData);
        }

        // update the colors
        const dataSets = sharedModelManager.getSharedModelsByType(kSharedDataSetType) as SharedDataSetType[];
        updateSharedDataSetColors(dataSets);
      },
      {name: "sharedModelSetup", fireImmediately: true}));

      // A rename on either side moves the other. Only this program's current dataset is watched,
      // so a table that has been detached keeps the headers it was captured with.
      addDisposer(self, reaction(
        () => Array.from(self.program.nodes.values())
          .map(node => `${node.id}:${node.data.orderedDisplayName ?? ""}`).join("|"),
        () => self.syncColumnNamesFromNodes(),
        {name: "syncColumnNamesFromNodes"}));

      addDisposer(self, reaction(
        () => self.dataSet.attributes.map(attr => `${attr.id}:${attr.name}`).join("|"),
        () => self.syncNodeNamesFromColumns(),
        {name: "syncNodeNamesFromColumns"}));

      // Structure only -- node and connection ids. A rename or a value change leaves the capture's
      // columns describing the program, so neither detaches. A reaction rather than a call inside
      // each structural action, so that withoutUndo applies; see detachLinkedTables.
      addDisposer(self, reaction(
        () => {
          const nodeIds = Array.from(self.program.nodes.keys()).sort().join(",");
          const connectionIds = Array.from(self.program.connections.keys()).sort().join(",");
          return `${nodeIds}|${connectionIds}`;
        },
        () => self.detachLinkedTables(),
        {name: "detachOnStructuralChange"}));
    },
    setProgram(program: any) {
      if (program) {
        applySnapshot(self.program, cloneDeep(program));
      }
    },
    setChannels(channels: NodeChannelInfo[]) {
      self.channels = observable(channels);
    },
    setProgramDataRate(dataRate: number) {
      self.programDataRate = dataRate;
    },
    setOutputConfig(config?: IDataflowOutputConfig) {
      // Store only non-default values; a default config clears the field so default units carry nothing.
      const next = config && (config.servoInputMode || config.allowedOutputTypes?.length) ? config : undefined;
      // Idempotent — avoid churning the doc when the resolved config hasn't changed.
      if (JSON.stringify(self.outputConfig) === JSON.stringify(next)) return;
      // This mirrors unit config on tile mount, not a user edit, so keep it off the undo stack.
      withoutUndo({ unlessChildAction: true });
      self.outputConfig = next;
    },
    setLiveProgramZoom(transform: Transform) {
      self.liveProgramZoom.update(transform);
    },
    setNeedsDevice(value: boolean) {
      self.needsDevice = value;
    },
    setShowConnectTutorialOnOpen(value: boolean) {
      self.showConnectTutorialOnOpen = value;
    },
    setPanPaletteOpen(open: boolean) {
      self.panPaletteOpen = open;
    },
    setConnectPaneOpen(open: boolean) {
      self.connectPaneOpen = open;
      if (open) self.unseenConnectError = false;
    },
    setConnectError(message?: string) {
      self.connectError = message;
    },
    setUnseenConnectError(value: boolean) {
      self.unseenConnectError = value;
    },
    clearConnectError() {
      self.connectError = undefined;
      self.unseenConnectError = false;
    },
    setLastPanDirection(direction: PanDirection) {
      self.lastPanDirection = direction;
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType){
      //do nothing
    },
    addNewAttrFromNode(nodeId: string, nodeName: string){
      const newAttributeId = uniqueId() + "*" + nodeId;
      self.dataSet.addAttributeWithID({
        id: newAttributeId,
        name: nodeName,
      });
    },
    addLinkedTile(tileId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && !self.isLinkedToTile(tileId)) {
        const linkedTileContents = getTileContentById(self, tileId);
        const linkedTileSharedModels = sharedModelManager.getTileSharedModels(linkedTileContents);
        if (linkedTileSharedModels.length > 1){ //table ideally should only have 1 shared dataSet
          console.warn("Tile has more than one shared dataSet");
        }
        //sever connection tile -> tile sharedDataSet
        linkedTileSharedModels.length > 0 &&
          sharedModelManager.removeTileSharedModel(linkedTileContents, linkedTileSharedModels[0]);
        //connect tile -> dataflow sharedDataset
        self.sharedModel && sharedModelManager.addTileSharedModel(linkedTileContents, self.sharedModel);
      }
      else {
        console.warn("DataflowContent.addLinkedTile unable to link tile");
      }
    },
    removeLinkedTable(tableId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && self.isLinkedToTile(tableId)) {
        //sever connection table -> table sharedDataSet
        const tableTileModel = getTileModelById(self, tableId); //get tableTile contents given a tableId
        const tableTileContent = tableTileModel?.content;
        self.sharedModel && sharedModelManager.removeTileSharedModel(tableTileContent, self.sharedModel);
      }
      else {
        console.warn("DataflowContent.addLinkedTable unable to unlink table");
      }
    },
    clearAttributes() {
      const allAttributes = self.dataSet.attributes;
      allAttributes.forEach((attr)=>{
        self.dataSet.removeAttribute(attr.id);
      });
    },
    clearCases() {
      const ids = self.dataSet.cases.map(({__id__}) => ( __id__));
      self.dataSet.removeCases(ids);
    },
  }))
  .actions(self => ({
    /**
     * Sets the table up for a fresh capture:
     *   Point | Node 1 | Node 2 | Node 3 ...
     *     1   |  val   |  val   |  val
     * The point number stays numeric so the Graph tile infers a numeric x-axis; the capture's
     * start time goes in the dataset's name instead of a column (see captureName).
     */
    prepareCapture(startedAt: Date = new Date()) {
      // Explicitly false, so `undefined` keeps meaning "saved before this flag existed". A capture
      // only counts as a recording once the record button says so (setRecordedRun).
      self.recordedRun = false;
      if (!self.isCapturePrepared) {
        self.clearAttributes();
        addAttributeToDataSet(self.dataSet, { name: kPointAttributeName });
        self.program.nodes.forEach((n) => { //add attributes based on nodes in tile
          n.data.orderedDisplayName && self.addNewAttrFromNode(n.id, n.data.orderedDisplayName);
        });
      }
      self.dataSet.setName(captureName(self.dataSet.name, startedAt));
    },
    setRecordedRun(value: boolean) {
      self.recordedRun = value;
    },
    resetRecording() {
      self.recordedRun = false;
      // No recording left, so the name should stop claiming one.
      self.dataSet.setName(stripCaptureTime(self.dataSet.name));
      //clear the dataSet;
      self.clearAttributes();
      self.clearCases();
      // create a default dataSet x | y table
      addAttributeToDataSet(self.dataSet, { name: "x" });
      addAttributeToDataSet(self.dataSet, { name: "y" });
    },
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
export type DataflowContentModelSnapshotIn = SnapshotIn<typeof DataflowContentModel>;

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  const formattedMinutes = minutes.toString().padStart(3, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}`;
}
