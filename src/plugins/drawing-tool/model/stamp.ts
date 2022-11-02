import { Instance, types } from "mobx-state-tree";

export const StampModel = types
  .model("Stamp", {
    url: types.string,
    width: types.number,
    height: types.number
  });
export interface StampModelType extends Instance<typeof StampModel> {}
