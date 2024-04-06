import { Instance, types } from "mobx-state-tree";
import { defaultMinigraphOptions } from "./dataflow-node-plot";
import { kMaxNodeValues } from "../model/utilities/node";
import { ClassicPreset } from "rete";
import { Socket } from "rete/_types/presets/classic";
import { DataflowProgramChange } from "../dataflow-logger";
import { INodeServices } from "./service-types";
import { Schemes } from "./rete-scheme";

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
  watchedValues: {
    "nodeValue": defaultMinigraphOptions
  } as Record<string, any>,

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
  setPlot(val: boolean) {
    self.plot = val;
  },

  setNodeValue(val: number) {
    self.nodeValue = val;
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
  setDsMin(min: number) { self.dsMin = min; }
}));
export interface IBaseNodeModel extends Instance<typeof BaseNodeModel> {}

export type NodeClass = new (id: string | undefined, model: any, services: INodeServices) => IBaseNode;

export type IBaseNode = Schemes['Node'] & {
  model: IBaseNodeModel;
  tick(): boolean;
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
   * Default tick function, nodes that need to tick should override this
   *
   * @returns whether the nodes need to reprocessed
   */
  tick() { return false; }

  process() {
    this.services.process();
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

