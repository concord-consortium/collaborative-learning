import { Instance, types } from "mobx-state-tree";
import { ClassicPreset } from "rete";
import { Socket } from "rete/_types/presets/classic";
import { kMaxNodeValues } from "../model/utilities/node";
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

export const BaseNodeModel = types.model("BaseNodeModel",
{
  // This should be overridden by the "subclasses"
  type: types.string,

  plot: false,

  // This is the name assigned by DataFlow, it probably should be renamed
  orderedDisplayName: types.maybe(types.string),

  // It isn't entirely clear this is the right way to model this.
  // In dataflow v1 these nodeValues and recentValues were basically
  // stored in state.
  // On export the recentValues were stripped.
  // When the dataflow tile was initialized the recentValues were
  // cleared if the tile was editable (not readOnly). This is because
  // node like the generator would have a wrong looking minigraph if the
  // previous recent values were loaded. The time value was not saved so
  // the generator would start generating at time 0 even though the
  // recentValues ended at some other time.

  /**
   * This is the default value that is plotted by the mini-graph. On some
   * nodes this is their output value. On other nodes this is one of their
   * input values.
   */
  nodeValue: types.maybe(StringifiedNumber),

  // FIXME: this union of number and null doesn't seem to be supported
  // in arrays. When the array is set to `[null]` MST is complaining
  recentValues: types.map(types.array(types.union(StringifiedNumber,types.null))),

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
.actions(self => ({
  process() {
    const program = getParentWithTypeName(self, "DataflowProgram") as any;
    if (!program) {
      console.warn("Can't find program for node");
      return;
    }
    if (!program.processor) {
      console.warn("Program doesn't have a processor");
      return;
    }
    program.processor.process();
  },

  setPlot(val: boolean) {
    self.plot = val;
  },

  setNodeValue(val: number) {
    self.nodeValue = val;
  },

  clearRecentValues() {
    self.recentValues.clear();
  },

  setRecentValues(newValues: Record<string, number[]>) {
    Object.entries(newValues).forEach(([key, values]) => {
      self.recentValues.set(key, values);
    });
  },

  updateRecentValues() {
    const { recentValues } = self;

    Object.keys(self.watchedValues).forEach((valueKey: string) => {
      const value: any = (self as any)[valueKey];

      // FIXME: this is bad, since a null value should be a valid recent
      // value over the past bit of time. However these null values are
      // causing problems for MST. We need to figure out how to tell
      // MST the array can be numbers or null. Or we could use undefined
      // if that works better.
      if (value == null) return;

      // This used to do:
      // let recentValue: NodeValue = {};
      // if (value === "number") {
      //   recentValue[valueKey] = { name: self.name, val: value };
      // } else {
      //   recentValue = value;
      // }
      // This makes no sense to me. If the value is the string "number" then
      // store a map with a value of an object with name of the node and
      // the val: "number".

      const existingRecentValuesForKey = recentValues.get(valueKey);
      if (existingRecentValuesForKey) {
        if (existingRecentValuesForKey.length > kMaxNodeValues) {
          existingRecentValuesForKey.shift();
        }
        existingRecentValuesForKey.push(value);
      } else {
        recentValues.set(valueKey, [value]);
      }
    });
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

    self.clearRecentValues();
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
}

