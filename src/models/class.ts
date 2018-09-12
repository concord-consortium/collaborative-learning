import { types } from "mobx-state-tree";
import { ClassInfo } from "../lib/auth";

export const ClassStudentModel = types
  .model("ClassStudent", {
    id: types.string,
    firstName: types.string,
    lastName: types.string,
    fullName: types.string,
    initials: types.string,
  });

export const ClassModel = types
  .model("Class", {
    name: types.string,
    classHash: types.string,
    students: types.array(ClassStudentModel),
  })
  .actions((self) => {
    return {
      updateFromPortal(classInfo: ClassInfo) {
        self.name = classInfo.name;
        self.classHash = classInfo.classHash;
        self.students.replace(
          classInfo.students.map((student) => {
            return ClassStudentModel.create({
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              fullName: student.fullName,
              initials: student.initials,
            });
          })
        );
      }
    };
  })
  .views((self) => {
    return {
      getStudentById(uid: string) {
        return self.students.find((student) => student.id === uid);
      }
    };
  });

export type ClassModelType = typeof ClassModel.Type;
