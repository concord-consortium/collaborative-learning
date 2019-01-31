import { types } from "mobx-state-tree";
import { ClassInfo } from "../../lib/auth";

export const ClassUserModel = types
  .model("ClassUser", {
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
    students: types.array(ClassUserModel),
    teachers: types.array(ClassUserModel),
  })
  .actions((self) => {
    return {
      updateFromPortal(classInfo: ClassInfo) {
        self.name = classInfo.name;
        self.classHash = classInfo.classHash;
        self.students.replace(
          classInfo.students.map((student) => {
            return ClassUserModel.create({
              id: student.id,
              firstName: student.firstName,
              lastName: student.lastName,
              fullName: student.fullName,
              initials: student.initials,
            });
          })
        );
        self.teachers.replace(
          classInfo.teachers.map((teacher) => {
            return ClassUserModel.create({
              id: teacher.id,
              firstName: teacher.firstName,
              lastName: teacher.lastName,
              fullName: teacher.fullName,
              initials: teacher.initials,
            });
          })
        );
      }
    };
  })
  .views((self) => {
    const getStudentById = (uid: string) => {
      return self.students.find((student) => student.id === uid);
    };
    const getTeacherById = (uid: string) => {
      return self.teachers.find((teacher) => teacher.id === uid);
    };
    return {
      getStudentById,
      getTeacherById,
      getUserById(uid: string) {
        return getStudentById(uid) || getTeacherById(uid);
      },
    };
  });

export type ClassModelType = typeof ClassModel.Type;
