import { types, SnapshotIn } from "mobx-state-tree";

export const HubChannel = types.model({
  id: types.string,
  type: types.string,
  dir: types.string,
  model: types.string,
  units: types.string,
  value: types.string,
});
export type HubChannelType = typeof HubChannel.Type;

export const HubModel = types
  .model("Thing", {
    hubArn: types.string,
    hubName: types.string,
    hubDisplayedName: types.string,
    hubTypeName: types.maybe(types.string),
    online: false,
    hubChannels: types.array(HubChannel),
  })
  .actions(self => ({
    addHubChannel(channel: HubChannelType) {
      self.hubChannels.push(channel);
    },
    removeHubChannel(index: number) {
      if (index < self.hubChannels.length ) {
        self.hubChannels.splice(index, 1);
      }
    },
    removeAllHubChannels() {
      self.hubChannels = [] as any;
    },
    getHubChannel(id: string) {
      return (self.hubChannels.find( ch => ch.id === id ));
    },
    setHubChannelValue(id: string, value: string) {
      self.hubChannels.forEach(ch => {
        if (ch.id === id) {
          ch.value = value;
        }
      });
    },
    getHubChannelValue(id: string) {
      let value = "";
      self.hubChannels.forEach(ch => {
        if (ch.id === id) {
          value = ch.value;
        }
      });
      return value;
    },
    setOnlineStatus(value: boolean) {
      self.online = value;
    },
  }));
export type HubModelType = typeof HubModel.Type;
type HubSnapshotType = SnapshotIn<typeof HubModel>;

export const HubStore = types
  .model("HubStore", {
    hubs: types.map(HubModel)
  })
  .views(self  => ({
    getThing(hubArn: string) {
      return self.hubs.get(hubArn);
    },
    getHubByName(hubName: string): HubModelType | undefined {
      const hubArray = Array.from(self.hubs.values());
      return (hubArray.find( hub => hub.hubName === hubName ));
    },
  }))
  .actions(self => ({
    addHub(snapshot: HubSnapshotType) {
      self.hubs.set(snapshot.hubArn, HubModel.create(snapshot));
    }
  }));

export type HubStoreType = typeof HubStore.Type;
