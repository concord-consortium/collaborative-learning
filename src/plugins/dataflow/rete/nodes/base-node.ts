import { Instance, types } from "mobx-state-tree";
import { defaultMinigraphOptions } from "../../nodes/dataflow-node-plot";
import { kMaxNodeValues } from "../../model/utilities/node";
import { ClassicPreset } from "rete";
import { Control, Socket } from "rete/_types/presets/classic";

export type NoInputs = Record<string, never>;
export type NoOutputs = Record<string, never>;

export function nodeType(type: string) {
  return types.optional(types.literal(type), type);
}

export const BaseNodeModel = types.model("BaseNodeModel",
{
  // This should be overridden by the "subclasses"
  type: types.string,

  plot: false,

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
  nodeValue: types.maybe(types.number),
  // FIXME: this union of number and null doesn't seem to be supported
  // in arrays. When the array is set to `[null]` MST is complaining
  recentValues: types.map(types.array(types.union(types.number,types.null))),

  // This is the name assigned by DataFlow, it probably should be renamed
  orderedDisplayName: types.maybe(types.string)
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

export interface IBaseNode {
  id: string;
  model: IBaseNodeModel;
  tick(): boolean;
}

export class BaseNode<
  Inputs extends { [key in string]?: Socket; },
  Outputs extends { [key in string]?: Socket; },
  Controls extends { [key in string]?: Control; },
  ModelType extends IBaseNodeModel
>
  extends ClassicPreset.Node<Inputs, Outputs, Controls>
  implements IBaseNode
{
  constructor(
    id: string | undefined,
    public model: ModelType
  ) {
    super(model.type);
    if (id) {
      this.id = id;
    }
  }

  /**
   * Default tick function, nodes that need to tick should override this
   *
   * @returns whether the nodes need to reprocessed
   */
  tick() { return false; }
}

