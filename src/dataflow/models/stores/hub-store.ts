import { types, cast, SnapshotIn } from "mobx-state-tree";

export const HubChannelModel = types.model({
  id: types.string,
  type: types.string,
  dir: types.string,
  model: types.string,
  units: types.string,
  value: types.string,
  lastUpdateTime: types.number,
  plug: types.number,
});
export type HubChannelType = typeof HubChannelModel.Type;

export const HubModel = types
  .model("Hub", {
    hubProviderId: types.string,
    hubId: types.string,
    hubName: types.string,
    hubType: types.maybe(types.string),
    hubChannels: types.array(HubChannelModel),
    hubUpdateTime: types.number,
  })
  .views(self => ({
    getHubChannel(id: string) {
      return (self.hubChannels.find( ch => ch.id === id ));
    },
    getOnlineStatus() {
      // WTD this will need a more sophisticated notion of "online"
      return (self.hubChannels.length > 0);
    },
  }))
  .views(self => ({
    getHubChannelValue(id: string) {
      let value = "";
      const ch = self.getHubChannel(id);
      if (ch) {
        value = ch.value;
      }
      return value;
    },
  }))
  .actions(self => ({
    addHubChannel(channel: HubChannelType) {
      self.hubChannels.push(channel);
    },
    removeHubChannel(id: string) {
      self.hubChannels = cast(self.hubChannels.filter(ch => ch.id !== id));
    },
    removeAllHubChannels() {
      self.hubChannels.clear();
    },
    setHubChannelValue(id: string, value: string) {
      const ch = self.getHubChannel(id);
      if (ch) {
        ch.value = value;
      }
    },
    setHubUpdateTime(newTime: number) {
      self.hubUpdateTime = newTime;
    },
    setHubChannelTime(id: string, newTime: number) {
      self.hubChannels.forEach(ch => {
        if (ch.id === id) {
          ch.lastUpdateTime = newTime;
        }
      });
    },
  }));
export type HubModelType = typeof HubModel.Type;
type HubSnapshotType = SnapshotIn<typeof HubModel>;

export const HubStore = types
  .model("HubStore", {
    hubs: types.map(HubModel)
  })
  .views(self  => ({
    getHub(hubProviderId: string) {
      return self.hubs.get(hubProviderId);
    },
    getHubById(hubId: string): HubModelType | undefined {
      const hubArray = Array.from(self.hubs.values());
      return (hubArray.find( hub => hub.hubId === hubId ));
    },
  }))
  .actions(self => ({
    addHub(snapshot: HubSnapshotType) {
      self.hubs.set(snapshot.hubProviderId, HubModel.create(snapshot));
    }
  }));

export type HubStoreType = typeof HubStore.Type;
