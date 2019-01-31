import { types } from "mobx-state-tree";
import { ClassInfo } from "../../lib/auth";

export enum ClassUserType {
  teacher = "teacher",
  student = "student"
}

export const ClassStudentModel = types
  .model("ClassStudent", {
    type: ClassUserType.student,
    id: types.string,
    firstName: types.string,
    lastName: types.string,
    fullName: types.string,
    initials: types.string,
  })
  .views((self) => {
    return {
      get displayName() {
        return self.fullName;
      }
    };
  });

export const ClassTeacherModel = types
  .model("ClassTeacer", {
    type: ClassUserType.teacher,
    id: types.string,
    firstName: types.string,
    lastName: types.string,
    fullName: types.string,
    initials: types.string,
  })
  .views((self) => {
    return {
      get displayName() {
        return `Teacher ${self.lastName}`;
      }
    };
  });

export const ClassUserModel = types.union(ClassStudentModel, ClassTeacherModel);

export const ClassModel = types
  .model("Class", {
    name: types.string,
    classHash: types.string,
    students: types.array(ClassStudentModel),
    teachers: types.array(ClassTeacherModel),
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
        self.teachers.replace(
          classInfo.teachers.map((teacher) => {
            return ClassTeacherModel.create({
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
