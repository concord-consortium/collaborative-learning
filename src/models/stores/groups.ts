import { types, getEnv, SnapshotIn, applySnapshot, hasEnv } from "mobx-state-tree";
import { DBOfferingGroup, DBOfferingGroupMap } from "../../lib/db-types";
import { ClassModelType } from "./class";
import { GroupVirtualDocument } from "../document/group-virtual-document";
import { UserModelType } from "./user";
import { DocumentsModelType } from "./documents";
import { ProblemPublication } from "../document/document-types";

export interface IGroupsEnvironment {
  user?: UserModelType,  // This is the current user of the application
  class?: ClassModelType,
  documents?: DocumentsModelType, // These are the documents of the application
}

export enum GroupUserState {
  Found,
  New,
  Removed,
}

export const GroupUserModel = types
  .model("GroupUser", {
    id: types.string,
    connectedTimestamp: types.number,
    disconnectedTimestamp: types.maybe(types.number),
  })
  .views(self => ({
    get environment() {
      return hasEnv(self) ? getEnv(self) as IGroupsEnvironment : undefined;
    }
  }))
  .views(self => ({
    get classUser() {
      return self.environment?.class?.getUserById(self.id);
    },
  }))
  .views(self => ({
    // If the student is not a recognized member of the class they might
    // either be a new student in the class or a student that was removed
    // from the class. Thew new student in the class can happen if the
    // user joins the class after the current user has started CLUE.
    get state(): GroupUserState {
      if (self.classUser) {
        return GroupUserState.Found;
      }
      // We add a little padding here. Perhaps the group user is being
      // created right as the class info is downloaded. So maybe the connectedTimestamp is
      // slightly older than the timestamp. If we decide the user is new, we'll be
      // refreshing the class from the portal. So if the user actually has been removed
      // then the refreshed class will have an newer timestamp. Which will change the state
      // to be Removed.
      // Also in the future we might support setting up the groups before the class is
      // initialized. For the time being we list users as New in that case.
      const clazz = self.environment?.class;
      if (!clazz || (self.connectedTimestamp + 1000) > clazz.timestamp) {
        return GroupUserState.New;
      }

      // At this point the the user isn't found in the class, and the connected timestamp is
      // older than the class update time. So we assume the user has been removed from the class.
      return GroupUserState.Removed;
    },
  }))
  .views(self => ({
    get name() {
      const {classUser} = self;
      if (classUser) {
        return classUser.fullName;
      }

      return self.state === GroupUserState.New ? "New User" : "Unknown";
    },
    get initials() {
      const {classUser} = self;
      if (classUser) {
        return classUser.initials;
      }

      return self.state === GroupUserState.New ? "**" : "??";
    },
    get connected() {
      const {connectedTimestamp, disconnectedTimestamp} = self;
      return !disconnectedTimestamp || (connectedTimestamp > disconnectedTimestamp);
    },
    get problemDocument() {
      return self.environment?.documents?.getProblemDocument(self.id);
    },
    get lastPublishedProblemDocument() {
      const publishedProblemDocs = self.environment?.documents?.byTypeForUser(ProblemPublication, self.id);
      if ( publishedProblemDocs?.length === 0) {
        return undefined;
      }
      return publishedProblemDocs?.reduce((prev, current) => (prev.createdAt > current.createdAt ) ? prev : current);
    }
  }));

export const GroupModel = types
  .model("Group", {
    id: types.identifier,
    users: types.array(GroupUserModel)
  })
  .views(self => ({
    get environment() {
      return hasEnv(self) ? getEnv(self) as IGroupsEnvironment : undefined;
    },
    get activeUsers() {
      return self.users.filter(user => user.state !== GroupUserState.Removed);
    }
  }))
  .views((self) => ({
    getUserById(id?: string) {
      return self.activeUsers.find(user => user.id === id);
    },
    get displayId() {
      const maxChars = 3;
      return self.id.length > maxChars ? self.id.slice(self.id.length - maxChars) : self.id;
    },
    // This will put the current user first if they are in this group
    get sortedUsers() {
      const sortedUsers = [...self.activeUsers];
      const userId = self.environment?.user?.id;
      return sortedUsers.sort((a, b) => {
        if (a.id === userId) return -1;
        if (b.id === userId) return 1;
        return 0;
      });
    }
  }));

export function getGroupSnapshot(groupId: string, groupFromDB: DBOfferingGroup) {
  const groupUserSnapshots: SnapshotIn<typeof GroupUserModel>[] = [];

  const groupUsers = groupFromDB.users || {};
  Object.keys(groupUsers).forEach((groupUserId) => {
    const groupUser = groupUsers[groupUserId];
    const {connectedTimestamp, disconnectedTimestamp} = groupUser;
    // self may be undefined if the database was deleted while a tab remains open
    // causing the disconnectedAt timestamp to be set at the groupUser level
    if (groupUser.self) {
      groupUserSnapshots.push({
        id: groupUserId,
        connectedTimestamp,
        disconnectedTimestamp
      });
    }
  });
  return {id: groupId, users: groupUserSnapshots};
}

export const GroupsModel = types
  .model("Groups", {
    groupsMap: types.map(GroupModel),
  })
  .views(self => ({
    get allGroups() {
      return [...self.groupsMap.values()];
    }
  }))
  .views((self) => ({
    get groupsByUser() {
      const groupsByUser: Record<string, GroupModelType> = {};
      self.allGroups.forEach((group) => {
        // We don't use activeUsers here incase some code is trying to
        // track down more info about a removed user
        group.users.forEach((groupUser) => {
          groupsByUser[groupUser.id] = group;
        });
      });
      return groupsByUser;
    },
    get nonEmptyGroups() {
      return self.allGroups.filter(g => g.users.length > 0);
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
    },
    get needToRefreshClass() {
      for (const group of self.allGroups) {
        for (const user of group.users) {
          if (user.state === GroupUserState.New) {
            return true;
          }
        }
      }
      return false;
    }
  }))
  .actions((self) => ({
    updateFromDB(groups: DBOfferingGroupMap) {
      const groupsMapSnapshot: SnapshotIn<typeof self.groupsMap> = {};
      Object.entries(groups).forEach(([groupId, group]) => {
        groupsMapSnapshot[groupId] = getGroupSnapshot(groupId, group);
      });
      applySnapshot(self.groupsMap, groupsMapSnapshot);
    }
  }));

export type GroupUserModelType = typeof GroupUserModel.Type;
export type GroupModelType = typeof GroupModel.Type;
export type GroupsModelType = typeof GroupsModel.Type;
