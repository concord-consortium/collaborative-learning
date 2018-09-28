import { ClassModel, ClassStudentModel } from "./class";
import { ClassInfo } from "../lib/auth";

describe("Class model", () => {

  it("has default values", () => {
    const clazz = ClassModel.create({
      name: "test class",
      classHash: "test"
    });
    expect(clazz.students.length).toEqual(0);
  });

  it("uses override values", () => {
    const student = ClassStudentModel.create({
      id: "1",
      firstName: "First",
      lastName: "Student",
      fullName: "First Student",
      initials: "FS",
    });
    const clazz = ClassModel.create({
      name: "test class",
      classHash: "test",
      students: [
        student
      ]
    });
    expect(clazz.students.length).toEqual(1);
    expect(clazz.getStudentById("1")).toBe(student);
    expect(clazz.getStudentById("2")).toEqual(undefined);
  });

  it("updates from the portal", () => {
    const clazz = ClassModel.create({
      name: "test class",
      classHash: "test",
    });
    const classInfo: ClassInfo = {
      name: "test class",
      classHash: "test",
      students: [
        {
          type: "student",
          className: "test class",
          classHash: "test",
          offeringId: "1",
          id: "1",
          portal: "test",
          firstName: "First",
          lastName: "Student",
          fullName: "First Student",
          initials: "FS",
        }
      ],
      teachers: []
    };
    clazz.updateFromPortal(classInfo);
    expect(clazz.students.length).toEqual(1);
  });
});
