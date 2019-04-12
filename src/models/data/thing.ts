import { types } from "mobx-state-tree";

export const ThingModel = types
  .model("Thing", {
    arn: types.string,
    thingName: types.string,
    thingTypeName: types.maybe(types.string),
    online: true
  })
  .views((self) => {
    return {
      get thingStatus() {
        return self.online;
      }
    };
  });

export type ThingModelType = typeof ThingModel.Type;
