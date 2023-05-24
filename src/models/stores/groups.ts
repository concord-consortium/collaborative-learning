import { types } from "mobx-state-tree";
import { DBOfferingGroupMap } from "../../lib/db-types";
import { ClassModelType } from "./class";
import { GroupVirtualDocument } from "../document/group-virtual-document";

export const GroupUserModel = types
  .model("GroupUser", {
    id: types.string,
    name: types.string,
    initials: types.string,
    connectedTimestamp: types.number,
    disconnectedTimestamp: types.maybe(types.number),
  })
  .views((self) => ({
    get connected() {
      const {connectedTimestamp, disconnectedTimestamp} = self;
      return !disconnectedTimestamp || (connectedTimestamp > disconnectedTimestamp);
    }
  }));

export const GroupModel = types
  .model("Group", {
    id: types.identifier,
    users: types.array(GroupUserModel)
  })
  .views((self) => ({
    getUserById(id?: string) {
      return self.users.find(user => user.id === id);
    },
    get displayId() {
      return self.id.slice(self.id.length - 3);
    }
  }));

export const GroupsModel = types
  .model("Groups", {
    allGroups: types.array(GroupModel),
    acceptUnknownStudents: false
  })
  .actions((self) => ({
    updateFromDB(groups: DBOfferingGroupMap, clazz: ClassModelType) {
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
            const student = clazz.getUserById(groupUser.self.uid);
            // skip students who are not recognized members of the class when authenticated
            // this actually occurred in the classroom causing great consternation
            // when previewing, however, we need to accept unknown students
            if (student || self.acceptUnknownStudents) {
              users.push(GroupUserModel.create({
                id: groupUserId,
                name: student?.fullName || "Unknown",
                initials: student?.initials || "??",
                connectedTimestamp,
                disconnectedTimestamp
              }));
            }
          }
        });
        return GroupModel.create({id: groupId, users});
      });
      self.allGroups.replace(allGroups);
    }
  }))
  .views((self) => ({
    get groupsByUser() {
      const groupsByUser: Record<string, GroupModelType> = {};
      self.allGroups.forEach((group) => {
        group.users.forEach((groupUser) => {
          groupsByUser[groupUser.id] = group;
        });
      });
      return groupsByUser;
    }
  }))
  .views((self) => ({
    groupForUser(uid: string) {
      return self.groupsByUser[uid];
    },
    groupIdForUser(uid: string) {
      return self.groupsByUser[uid]?.id;
    },
    get groupVirtualDocuments() {
      return self.allGroups.map((group) => {
        return new GroupVirtualDocument(group);
      });
    },
    getGroupById(id?: string) {
      return self.allGroups.find(group => group.id === id);
    },
  }))
  .views((self) => ({
    userInGroup(uid: string, groupId?: string) {
      const groupUser = self.groupForUser(uid);
      return !!(groupId && groupUser && (groupUser.id === groupId));
    },
    virtualDocumentForGroup(documentKey: string) {
      return self.groupVirtualDocuments.find((g) => documentKey === g.key);
    }
  }));

export type GroupUserModelType = typeof GroupUserModel.Type;
export type GroupModelType = typeof GroupModel.Type;
export type GroupsModelType = typeof GroupsModel.Type;
