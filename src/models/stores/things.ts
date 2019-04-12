import { types } from "mobx-state-tree";
import { ThingModel } from "../data/thing";

export const ThingsModel = types
  .model("Things", {
    things: types.array(ThingModel)
  })
  .views((self) => {
    return {
      get allThings() {
        return self.things;
      }
    };
  }).actions(self => ({
    addThing(
      thingArn: string,
      thingName: string,
      thingTypeName: string,
      thingOnline: boolean) {
      self.things.push(
        ThingModel.create({ arn: thingArn, thingName, thingTypeName, online: thingOnline })
      );
    }
  }));

export type ThingsModelType = typeof ThingsModel.Type;
