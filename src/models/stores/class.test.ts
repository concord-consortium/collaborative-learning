import { ClassModel, ClassUserModel } from "./class";
import { ClassInfo } from "./portal";

describe("Class model", () => {

  it("has default values", () => {
    const clazz = ClassModel.create({
      name: "test class",
      classHash: "test"
    });
    expect(clazz.users.size).toEqual(0);
  });

  it("uses override values", () => {
    const student = ClassUserModel.create({
      type: "student",
      id: "1",
      firstName: "First",
      lastName: "Student",
      fullName: "First Student",
      initials: "FS",
    });
    const clazz = ClassModel.create({
      name: "test class",
      classHash: "test",
      users: {
        1: student
      }
    });
    expect(clazz.users.size).toEqual(1);
    expect(clazz.getUserById("1")).toBe(student);
    expect(clazz.getUserById("2")).toBeUndefined();
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
      teachers: [],
      localTimestamp: Date.now()
    };
    clazz.updateFromPortal(classInfo, false);

    // There is always a exemplar user added to the class
    expect(clazz.users.size).toEqual(2);
  });

  it("includes AI user when configured", () => {
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
      teachers: [],
      localTimestamp: Date.now()
    };
    clazz.updateFromPortal(classInfo, true);

    // Student 1, II, and AI
    expect(clazz.users.size).toEqual(3);
    expect(clazz.getUserById("1")).toBeDefined();
    expect(clazz.getUserById("ivan_idea_1")).toBeDefined();
    expect(clazz.getUserById("ada_insight_1")).toBeDefined();
  });
});
