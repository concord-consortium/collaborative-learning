import { types, Instance, SnapshotIn } from "mobx-state-tree";

export const GroupUserActivityFocus = types.model("GroupUserActivityFocus", {
  tileIds: types.array(types.string)
});

export const GroupUserActivity = types.model("GroupUserActivity", {
  userId: types.identifier,
  documentKey: types.string,
  focus: types.maybe(GroupUserActivityFocus),
  updatedAt: types.number
});
export type GroupUserActivityType = Instance<typeof GroupUserActivity>;
export type GroupUserActivitySnapshot = SnapshotIn<typeof GroupUserActivity>;

export const GroupActivityModel = types
  .model("GroupActivity", {
    activities: types.map(GroupUserActivity)
  })
  .views(self => ({
    usersFocusedOnTile(documentKey: string, tileId: string, skipUserId?: string): GroupUserActivityType[] {
      const result: GroupUserActivityType[] = [];
      self.activities.forEach(activity => {
        const includeUser = !skipUserId || activity.userId !== skipUserId;
        if (includeUser && activity.documentKey === documentKey && activity.focus?.tileIds.includes(tileId)) {
          result.push(activity);
        }
      });
      return result;
    }
  }))
  .actions(self => ({
    setActivity(snapshot: GroupUserActivitySnapshot) {
      self.activities.set(snapshot.userId, snapshot);
    },
    removeActivity(userId: string) {
      self.activities.delete(userId);
    },
    clear() {
      self.activities.clear();
    }
  }));

export type GroupActivityModelType = Instance<typeof GroupActivityModel>;
