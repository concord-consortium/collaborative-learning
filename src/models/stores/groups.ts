import { types, getEnv, SnapshotIn, applySnapshot } from "mobx-state-tree";
import { DBOfferingGroupMap } from "../../lib/db-types";
import { ClassModelType } from "./class";
import { GroupVirtualDocument } from "../document/group-virtual-document";
import { UserModelType } from "./user";
import { DocumentsModelType } from "./documents";
import { ProblemPublication } from "../document/document-types";

export interface IGroupsEnvironment {
  user?: UserModelType,  // This is the current user of the application
  documents?: DocumentsModelType, // These are the documents of the application
}

export const GroupUserModel = types
  .model("GroupUser", {
    id: types.string,
    name: types.string,
    initials: types.string,
    connectedTimestamp: types.number,
    disconnectedTimestamp: types.maybe(types.number),
  })
  .views(self => ({
    get environment() {
      return getEnv(self) as IGroupsEnvironment;
    }
  }))
  .views((self) => ({
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
    acceptUnknownStudents: false
  })
  .actions((self) => ({
    updateFromDB(groups: DBOfferingGroupMap, clazz: ClassModelType) {
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
            // skip students who are not recognized members of the class when authenticated
            // this actually occurred in the classroom causing great consternation
            // when previewing, however, we need to accept unknown students

            // TODO: we need accept unknown student in the case where a student joins the class
            // after another student has launched CLUE. If this new student joins the group
            // they won't show up. What we want to do is show them as "Unknown" or "Loading"
            // and then trigger a request to get the latest roster from the portal. When
            // we get the roster we should update this group user with the correct name
            // and initials.
            if (student || self.acceptUnknownStudents) {
              groupUserSnapshots.push({
                id: groupUserId,
                name: student?.fullName || "Unknown",
                initials: student?.initials || "??",
                connectedTimestamp,
                disconnectedTimestamp
              });
            }
          }
        });
        groupsMapSnapshot[groupId] = {id: groupId, users: groupUserSnapshots};
      });
      applySnapshot(self.groupsMap, groupsMapSnapshot);
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
