import { applySnapshot, SnapshotIn, types } from "mobx-state-tree";
import { ClassInfo } from "../../lib/auth";
import { kExemplarUserParams } from "./user-types";

export const ClassUserModel = types
  .model("ClassUser", {
    type: types.enumeration("UserType", ["teacher", "student"]),
    id: types.identifier,
    firstName: types.string,
    lastName: types.string,
    fullName: types.string,
    initials: types.string,
  })
  .views((self) => {
    return {
      get displayName() {
        return self.type === "teacher"
          ? `Teacher ${self.lastName}`
          : self.fullName;
      }
    };
  });

export const ClassModel = types
  .model("Class", {
    name: types.string,
    classHash: types.string,
    users: types.map(ClassUserModel),
    timestamp: types.optional(types.number, () => Date.now()),
  })
  .actions((self) => {
    return {
      updateFromPortal(classInfo: ClassInfo) {
        const usersSnapshot: SnapshotIn<typeof self.users> = {
        };
        const users = [...classInfo.teachers, ...classInfo.students];
        users.forEach((user) => {
          usersSnapshot[user.id] = user;
        });

        // Add the fake exemplar user
        usersSnapshot[kExemplarUserParams.id] = kExemplarUserParams;

        // applySnapshot is used so the same user objects are updated
        applySnapshot(self.users, usersSnapshot);
        self.name = classInfo.name;
        self.classHash = classInfo.classHash;
        self.timestamp = classInfo.serverTimestamp || classInfo.localTimestamp;
      },
    };
  })
  .views((self) => {
    return {
      getUserById(uid: string) {
        return self.users.get(uid);
      },
      get students() {
        return Array.from(self.users.values()).filter(u=>u.type === "student");
      }
    };
  })
  .views((self) => {
    return {
      isTeacher(uid: string) {
        const user =  self.getUserById(uid);
        return user?.type === "teacher";
      }
    };
  });

export type ClassModelType = typeof ClassModel.Type;
