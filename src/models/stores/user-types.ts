import { Instance, types } from "mobx-state-tree";

export const UserTypeEnum = types.enumeration("type", ["student", "teacher"]);
export type UserType = Instance<typeof UserTypeEnum>;

export const DisplayUserTypeEnum = types.maybe(UserTypeEnum);
export type DisplayUserType = Instance<typeof DisplayUserTypeEnum>;

export const kExemplarUserParams = {
  type: "student",
  id: "ivan_idea_1",
  firstName: "Ivan",
  lastName: "Idea",
  fullName: "Ivan Idea",
  initials: "II",
};
