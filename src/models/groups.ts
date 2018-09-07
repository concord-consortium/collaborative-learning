import { types } from "mobx-state-tree";
import { DBOfferingGroup, DBOfferingGroupMap } from "../lib/db-types";

export const GroupUserModel = types
  .model("GroupUser", {
    id: types.string,
    initials: types.string,
    connected: false,
    connectedTimestamp: types.maybe(types.number),
    disconnectedTimestamp: types.maybe(types.number),
  });

export const GroupModel = types
  .model("Group", {
    id: types.identifier,
    users: types.array(GroupUserModel)
  });

export const GroupsModel = types
  .model("Groups", {
    allGroups: types.array(GroupModel),
  })
  .actions((self) => {
    return {
      updateFromDB(uid: string, groups: DBOfferingGroupMap) {
        const allGroups = Object.keys(groups).map((groupId) => {
          const group = groups[groupId];
          const users = Object.keys(group.users || {}).map((groupUserId) => {
            const {connected, connectedTimestamp, disconnectedTimestamp} = group.users[groupUserId];
            return GroupUserModel.create({
              id: groupUserId,
              initials: "TD",
              connected,
              connectedTimestamp,
              disconnectedTimestamp
            });
          });
          return GroupModel.create({id: groupId, users});
        });
        self.allGroups.replace(allGroups);
      }
    };
  })
  .views((self) => {
    return {
      groupForUser(uid: string) {
        return self.allGroups.find((group) => {
          return !!group.users.find((user) => user.id === uid);
        });
      }
    };
  });

export type GroupUserModelType = typeof GroupUserModel.Type;
export type GroupModelType = typeof GroupModel.Type;
export type GroupsModelType = typeof GroupsModel.Type;
