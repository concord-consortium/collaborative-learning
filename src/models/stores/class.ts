import { types } from "mobx-state-tree";
import { ClassInfo } from "../../lib/auth";

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
  })
  .actions((self) => {
    return {
      updateFromPortal(classInfo: ClassInfo) {
        self.users.clear();
        self.name = classInfo.name;
        self.classHash = classInfo.classHash;
        const users = [...classInfo.teachers, ...classInfo.students];
        users.forEach((user) => {
          self.users.put(ClassUserModel.create({
            type: user.type,
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            initials: user.initials,
          }));
        });
      }
    };
  })
  .views((self) => {
    return {
      getUserById(uid: string) {
        return self.users.get(uid);
      }
    };
  });

export type ClassModelType = typeof ClassModel.Type;
