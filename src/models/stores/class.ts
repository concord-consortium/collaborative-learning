import { applySnapshot, SnapshotIn, types } from "mobx-state-tree";
import { ClassInfo } from "./portal";
import { kAnalyzerUserParams, kExemplarUserParams } from "../../../shared/shared";

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
      updateFromPortal(classInfo: ClassInfo, includeAIUser: boolean) {
        const usersSnapshot: SnapshotIn<typeof self.users> = {
        };
        const users = [...classInfo.teachers, ...classInfo.students];
        users.forEach((user) => {
          usersSnapshot[user.id] = user;
        });

        // Add the fake exemplar user
        usersSnapshot[kExemplarUserParams.id] = kExemplarUserParams;

        // Add AI user if the unit has AI analysis configured
        if (includeAIUser) {
          usersSnapshot[kAnalyzerUserParams.id] = kAnalyzerUserParams;
        }

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
      // RESEARCHER-ACCESS: we use this to gate access to certain features
      // that are only available to teachers but may need to be available to
      // researchers as well.  How do we want to handle this since the
      // researcher is not in the class list?
      isTeacher(uid: string) {
        const user =  self.getUserById(uid);
        return user?.type === "teacher";
      }
    };
  });

export type ClassModelType = typeof ClassModel.Type;
