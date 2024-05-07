import { Instance, getSnapshot, types } from "mobx-state-tree";
import { ClassicPreset } from "rete";
import { Socket } from "rete/_types/presets/classic";
import { DataflowProgramChange } from "../dataflow-logger";
import { INodeServices } from "./service-types";
import { Schemes } from "./rete-scheme";
import { MinigraphOptions, defaultMinigraphOptions } from "./dataflow-node-plot-types";
import { getParentWithTypeName } from "../../../utilities/mst-utils";
import { DEBUG_DATAFLOW } from "../../../lib/debug";

export type NoInputs = Record<string, never>;
export type NoOutputs = Record<string, never>;

// This handles NaN, Infinity, and -Infinity
// This would be more efficient if only those values were stored
// as strings, but that would complicate the isTargetType function
export const StringifiedNumber = types.custom<string, number>({
  name: "StringifiedNumber",
  fromSnapshot(snapshot: string, env?: any): number {
    return Number(snapshot);
  },
  toSnapshot(value: number): string {
    return value.toString();
  },
  isTargetType(value: string | number): boolean {
    return typeof value === "number";
  },
  getValidationMessage(snapshot: string): string {
    const parsed = Number(snapshot);
    if (isNaN(parsed) && snapshot !== "NaN") {
      return `'${snapshot}' can't be parsed as a number`;
    } else {
      return "";
    }
  }
});

export const BaseTickEntry = types.model("BaseTickEntry",
{
  /**
   * The open flag is removed after the tick, so the lack of `open`
   * indicates the the entry has been closed or completed.
   * This is used so open entries stored in the history can be ignored
   * if they are restored. This can happen when a node is deleted.
   * See the "Undo Support" section `dataflow.md`.
   */
  open: types.maybe(types.boolean),

  nodeValue: types.maybe(StringifiedNumber),

  // Nodes can extend this to add custom properties.
  // The node needs to override the default tickEntries field from the BaseNodeModel with its own tickEntries
  // that uses the nodes custom TickEntry type.
});
export interface IBaseTickEntry extends Instance<typeof BaseTickEntry> {}

export const BaseNodeModel = types.model("BaseNodeModel",
{
  // This should be overridden by the "subclasses"
  type: types.string,

  plot: false,

  // This is the name assigned by DataFlow, it probably should be renamed
  orderedDisplayName: types.maybe(types.string),

  tickEntries: types.map(BaseTickEntry),

})
.volatile(self => ({
  // FIXME: the watchedValues are not observable. This means that when the data function of
  // the demo output node adds the tilt, this new tilt does not show up in the plot until the
  // next render of the plot which happens on the next tick.
  // The following observable approach doesn't work because this model is somehow passed to
  // a React component's style property via Rete, and that freezes the property. MobX doesn't
  // allow freezing dynamic objects (onces where new members are automatically observed).
  // watchedValues: observable({
  //   "nodeValue": defaultMinigraphOptions
  // }) as Record<string, MinigraphOptions>,
  watchedValues: {
    "nodeValue": defaultMinigraphOptions
  } as Record<string, MinigraphOptions>,

  // Plot properties: it might make sense to move these out of this model

  // Dataset range based on all of the recentValue data, there might be multiple
  // properties being watched
  dsMax: -Infinity,
  dsMin: Infinity,

  // user defined range set by clicking on the graph
  tickMax: undefined as number | undefined,
  tickMin: undefined as number | undefined
}))
.views(self => ({
  get program() {
    const program = getParentWithTypeName(self, "DataflowProgram") as any;
    if (!program) {
      console.warn("Can't find program for node");
      return;
    }
    return program;
  }
}))
.views(self => ({
  get currentTick() {
    const program = self.program;
    return program?.currentTick || "";
  }
}))
.views(self => ({
  get nodeValue() {
    return self.tickEntries.get(self.currentTick)?.nodeValue;
  },

  getTickEntries(ticks: string[]) {
    return ticks.map(tick => self.tickEntries.get(tick));
  },
}))
.actions(self => ({
  process() {
    const program = self.program;
    if (!program?.processor) {
      console.warn("Program doesn't have a processor");
      return;
    }
    program.processor.process();
  },

  setPlot(val: boolean) {
    self.plot = val;
  },

  setNodeValue(val: number) {
    const currentEntry = self.tickEntries.get(self.currentTick);
    if (currentEntry) {
      currentEntry.nodeValue = val;
    } else {
      console.warn("No current tick entry");
    }
  },

  setOrderedDisplayName(str: string) {
    self.orderedDisplayName = str;
  },

  createNextTickEntry(currentTick: string | undefined, nextTick: string, recentTicks?: string[]) {
    const previousEntry = currentTick && self.tickEntries.get(currentTick);
    if (previousEntry) {
      const previousSnapshot = getSnapshot(previousEntry);
      self.tickEntries.set(nextTick, previousSnapshot);
      previousEntry.open = undefined;
    } else {
      self.tickEntries.set(nextTick, {open: true});
    }
    if (recentTicks) {
      // Clean up old tick entries
      for(const key of self.tickEntries.keys()) {
        if (!recentTicks.includes(key)) {
          self.tickEntries.delete(key);
        }
      }
    }
  },

  clearTickEntries() {
    self.tickEntries.clear();
  },

  setTickMax(max: number) { self.tickMax = max; },
  setTickMin(min: number) { self.tickMin = min; },
  setDsMax(max: number) { self.dsMax = max; },
  setDsMin(min: number) { self.dsMin = min; },
}))
.actions(self => ({
  resetGraph () {
    self.dsMax = -Infinity;
    self.dsMin = Infinity;

    self.tickMax = undefined;
    self.tickMin = undefined;

    // FIXME: if this change is restored on top of a future tick
    // the the old tick entries will be restored. This can result in
    // a plot with wrong points on it.
    self.clearTickEntries();
  }
}));
export interface IBaseNodeModel extends Instance<typeof BaseNodeModel> {}

export type NodeClass = new (id: string | undefined, model: any, services: INodeServices) => IBaseNode;

export type IBaseNode = Schemes['Node'] & {
  model: IBaseNodeModel;
  dispose(): void;
  process(): void;
  select(): void;
  isConnected(inputKey: string): boolean;
  logControlEvent(
    operation: string,
    controlType: string,
    key: string,
    value: string | number | boolean,
    units?: string
  ): void;
  logNodeEvent(
    operation: string
  ): void;
  readOnly?: boolean;
  getDisplayValue?: () => string;
  getDisplayMessage?: () => string;
  getNodeValueDisplayMessage?: () => string;
  getSentence?: () => string;
}

export class BaseNode<
  Inputs extends { [key in string]?: Socket; },
  Outputs extends { [key in string]?: Socket; },
  Controls extends Schemes['Node']['controls'],
  ModelType extends IBaseNodeModel
>
  extends ClassicPreset.Node<Inputs, Outputs, Controls>
  implements IBaseNode
{
  constructor(
    id: string | undefined,
    public model: ModelType,
    public services: INodeServices
  ) {
    super(model.type);
    if (id) {
      this.id = id;
    }
  }

  /**
   * Default data function, nodes need to override this
   */
  data(inputs: Record<string, any>): Record<string, any> | Promise<Record<string, any>> {
    return {};
  }

  /**
   * If a node has created reactions or other things that need to be cleaned up,
   * do so here.
   */
  dispose() {}

  process() {
    this.services.process();
  }

  get readOnly() {
    return this.services.readOnly;
  }

  /**
   * Save the node value in the node state if we aren't in a readOnly document
   *
   * @param nodeValue
   */
  saveNodeValue(nodeValue: number) {
    if (!this.readOnly) {
      this.model.setNodeValue(nodeValue);
    } else {
      if (DEBUG_DATAFLOW && nodeValue !== this.model.nodeValue) {
        // In readOnly mode we should normally be called with the same value
        // that is already set on the model. If we are called with a different
        // value it means the data function of the node has some non deterministic
        // which will cause inconsistencies in the diagram.
        // There is currently at least one case that causes this to happen which haven't
        // be fixed yet:
        // - when a new node is added to the diagram this causes to snapshot updates
        // one for the new node, and a second for the process call which updates the
        // new nodes value. This triggers the warning because the readOnly tile
        // is watching the snapshot and will try to initialize the nodeValue too.
        console.warn("saveNodeValue called with a different value",
          {passedValue: nodeValue, currentValue: this.model.nodeValue});
      }
    }
  }

  /**
   * Select this node
   */
  select() {
    this.services.selectNode(this.id);
  }

  isConnected(inputKey: string) {
    return this.services.isConnected(this.id, inputKey);
  }

  logNodeEvent(operation: string) {
    const change: DataflowProgramChange = {
      targetType: 'node',
      nodeTypes: [this.model.type],
      nodeIds: [this.id],
    };

    this.services.logTileChangeEvent({operation, change });
  }

  logControlEvent(
    operation: string,
    controlType: string,
    key: string,
    value: string | number | boolean,
    units?: string
  ) {
    const change: DataflowProgramChange = {
      targetType: controlType,
      nodeTypes: [this.model.type],
      nodeIds: [this.id],
      selectItem: key,
      value,
      units: units || ""
    };

    this.services.logTileChangeEvent({operation, change});
  }

  previousTickNodeValue() {
    const recentTicks = this.services.recentTicks;
    const { length } = recentTicks;

    // The current open tick will be the last item in the list.
    // Its nodeValue will be the same as this.model.nodeValue
    // The last recorded entry will be the second to last item.
    // If the data function hasn't changed the nodeValue since the last tick,
    // the nodeValue in the last recorded entry will be the same as the
    // currentNode value.
    // So if the data function only changes the value during the tick, the
    // previous value will be the third to the last item.
    if (length < 3) return null;

    const previousEntry = this.model.tickEntries.get(recentTicks[length - 3]);
    return previousEntry ? previousEntry.nodeValue : null;
  }

  recordedValues() {
    const { recordedTicks } = this.services;
    return recordedTicks.map(tick => this.model.tickEntries.get(tick)?.nodeValue);
  }
}

