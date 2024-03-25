import { types } from "mobx-state-tree";
import { defaultMinigraphOptions } from "../../nodes/dataflow-node-plot";

export const BaseNodeModel = types.model("BaseNodeModel",
{
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
  recentValues: types.map(types.array(types.number))
})
.volatile(self => ({
  watchedValues: {
    "nodeValue": defaultMinigraphOptions
  } as Record<string, any>
}))
.actions(self => ({
  setNodeValue(val: number) {
    self.nodeValue = val;
  }
}));
