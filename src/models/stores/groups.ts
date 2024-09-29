import { types, getEnv, SnapshotIn, applySnapshot } from "mobx-state-tree";
import { DBOfferingGroupMap } from "../../lib/db-types";
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

export const GroupUserModel = types
  .model("GroupUser", {
    id: types.string,
    connectedTimestamp: types.number,
    disconnectedTimestamp: types.maybe(types.number),
  })
  .views(self => ({
    get environment() {
      return getEnv(self) as IGroupsEnvironment;
    }
  }))
  .views(self => ({
    get user() {
      return self.environment.class?.getUserById(self.id);
    }
  }))
  .views(self => ({
    get name() {
      return self.user?.fullName || "Unknown";
    },
    get initials() {
      return self.user?.initials || "??";
    },
    get connected() {
      const {connectedTimestamp, disconnectedTimestamp} = self;
      return !disconnectedTimestamp || (connectedTimestamp > disconnectedTimestamp);
    },
    get problemDocument() {
      return self.environment.documents?.getProblemDocument(self.id);
    },
    get lastPublishedProblemDocument() {
      const publishedProblemDocs = self.environment.documents?.byTypeForUser(ProblemPublication, self.id);
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
      return getEnv(self) as IGroupsEnvironment;
    }
  }))
  .views((self) => ({
    getUserById(id?: string) {
      return self.users.find(user => user.id === id);
    },
    get displayId() {
      const maxChars = 3;
      return self.id.length > maxChars ? self.id.slice(self.id.length - maxChars) : self.id;
    },
    // This will put the current user first if they are in this group
    get sortedUsers() {
      const sortedUsers = [...self.users];
      const userId = self.environment.user?.id;
      return sortedUsers.sort((a, b) => {
        if (a.id === userId) return -1;
        if (b.id === userId) return 1;
        return 0;
      });
    }
  }));

export const GroupsModel = types
  .model("Groups", {
    groupsMap: types.map(GroupModel),
  })
  .actions((self) => ({
    updateFromDB(groups: DBOfferingGroupMap, clazz: ClassModelType) {
      let needToRefreshClass = false;
      const groupsMapSnapshot: SnapshotIn<typeof self.groupsMap> = {};
      Object.entries(groups).forEach(([groupId, group]) => {
        const groupUserSnapshots: SnapshotIn<typeof GroupUserModel>[] = [];

        const groupUsers = group.users || {};
        Object.keys(groupUsers).forEach((groupUserId) => {
          const groupUser = groupUsers[groupUserId];
          const {connectedTimestamp, disconnectedTimestamp} = groupUser;
          // self may be undefined if the database was deleted while a tab remains open
          // causing the disconnectedAt timestamp to be set at the groupUser level
          if (groupUser.self) {
            const student = clazz.getUserById(groupUser.self.uid);

            // If the student is not a recognized member of the class we show them
            // as Unknown. This can happen if a user joins the class after the current
            // user has started CLUE.
            // However if users see Unknown and ?? in their group lists they can
            // get confused. This happened before. A better approach would be to show
            // some kind of loading indication, and then if it times out and no user
            // is found then we hid the user or show an error instead of Unknown.
            groupUserSnapshots.push({
              id: groupUserId,
              connectedTimestamp,
              disconnectedTimestamp
            });

            if (!student) {
              needToRefreshClass = true;
            }
          }
        });
        groupsMapSnapshot[groupId] = {id: groupId, users: groupUserSnapshots};
      });
      applySnapshot(self.groupsMap, groupsMapSnapshot);

      if (needToRefreshClass) {
        // TODO: Request classInfo from the portal then pass it to updateFromPortal.
        // This might be better to move somewhere else.
        // const classInfo = {} as ClassInfo;
        // if (classInfo) {
        //   clazz.updateFromPortal(classInfo);
        // }
        //
        // TODO: if a student is removed from the class by the teacher what should
        // happen to the groups? This is a legitimate reason to skip unknown users.
        // However we won't know the difference between a student that is deleted
        // and one we don't know about it.
        //
        // TODO: what was the previous "preview behavior"? Did it automatically add
        // students to the group?
      }
    }
  }))
  .views(self => ({
    get allGroups() {
      return [...self.groupsMap.values()];
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
    }
  }));

export type GroupUserModelType = typeof GroupUserModel.Type;
export type GroupModelType = typeof GroupModel.Type;
export type GroupsModelType = typeof GroupsModel.Type;
