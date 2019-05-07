import { types, SnapshotIn } from "mobx-state-tree";

export const ThingModel = types
  .model("Thing", {
    thingArn: types.string,
    thingName: types.string,
    thingTypeName: types.maybe(types.string),
    value: types.maybe(types.number),
    online: true
  })
  .actions(self => ({
    setValue(value: number) {
      self.value = value;
    }
  }));
export type ThingModelType = typeof ThingModel.Type;
type ThingSnapshotType = SnapshotIn<typeof ThingModel>;

export const ThingStore = types
  .model("ThingStore", {
    things: types.map(ThingModel)
  })
  .views(self  => ({
    getThing(thingArn: string) {
      return self.things.get(thingArn);
    }
  }))
  .actions(self => ({
    addThing(snapshot: ThingSnapshotType) {
      self.things.set(snapshot.thingArn, ThingModel.create(snapshot));
    }
  }));

export type ThingStoreType = typeof ThingStore.Type;
