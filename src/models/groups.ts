import { types } from "mobx-state-tree";
import { DBOfferingGroupMap } from "../lib/db-types";
import { ClassModelType } from "./class";

export const GroupUserModel = types
  .model("GroupUser", {
    id: types.string,
    name: types.string,
    initials: types.string,
    connectedTimestamp: types.number,
    disconnectedTimestamp: types.maybe(types.number),
  })
  .views((self) => {
    return {
      get connected() {
        const {connectedTimestamp, disconnectedTimestamp} = self;
        return !disconnectedTimestamp || (connectedTimestamp > disconnectedTimestamp);
      }
    };
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
      updateFromDB(uid: string, groups: DBOfferingGroupMap, clazz: ClassModelType) {
        const allGroups = Object.keys(groups).map((groupId) => {
          const group = groups[groupId];
          const groupUsers = group.users || {};
          const users: GroupUserModelType[] = [];
          Object.keys(groupUsers).forEach((groupUserId) => {
            const groupUser = groupUsers[groupUserId];
            const {connectedTimestamp, disconnectedTimestamp} = groupUser;
            // self may be undefined if the database was deleted while a tab remains open
            // causing the disconnectedAt timestamp to be set at the groupUser level
            if (groupUser.self) {
              const student = clazz.getStudentById(groupUser.self.uid);
              users.push(GroupUserModel.create({
                id: groupUserId,
                name: student ? student.fullName : "Unknown",
                initials: student ? student.initials : "??",
                connectedTimestamp,
                disconnectedTimestamp
              }));
            }
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
