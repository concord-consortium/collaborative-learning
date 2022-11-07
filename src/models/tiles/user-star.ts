import { types, Instance } from "mobx-state-tree";

export const UserStarModel = types
.model("UserStar", {
  key: types.optional(types.identifier, ""),
  uid: types.string,
  starred: true
})
.actions(self  => ({
  toggleStarred() {
    self.starred = !self.starred;
  },
}));
export type UserStarModelType = Instance<typeof UserStarModel>;
