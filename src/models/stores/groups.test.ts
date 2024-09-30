import { GroupsModel, GroupModel, GroupUserModel } from "./groups";
import { ClassModel, ClassUserModel } from "./class";
import { DBOfferingGroupMap } from "../../lib/db-types";

describe("Groups model", () => {

  it("has default values", () => {
    const groups = GroupsModel.create({});
    expect(groups.allGroups).toEqual([]);
    expect(groups.getGroupById("1")).toBeUndefined();
    expect(groups.groupForUser("1")).toBeUndefined();
    expect(groups.userInGroup("1")).toBe(false);
    expect(groups.userInGroup("1", "1")).toBe(false);
    expect(groups.virtualDocumentForGroup("1")).toBeUndefined();
  });

  it("uses override values", () => {
    const group = GroupModel.create({
      id: "1",
      users: [
        GroupUserModel.create({
          id: "1",
          connectedTimestamp: 1,
        }),
        GroupUserModel.create({
          id: "2",
          connectedTimestamp: 1,
          disconnectedTimestamp: 2,
        }),
        GroupUserModel.create({
          id: "3",
          connectedTimestamp: 3,
          disconnectedTimestamp: 2,
        }),
      ],
    });
    const groups = GroupsModel.create({
      groupsMap: {1: group}
    });
    expect(group.getUserById("1")).toBeDefined();
    expect(group.getUserById("2")).toBeDefined();
    expect(group.getUserById("3")).toBeDefined();
    expect(group.getUserById("4")).toBeUndefined();
    expect(groups.allGroups).toEqual([group]);
    expect(groups.allGroups[0].users).toEqual(group.users);
    expect(groups.allGroups[0].users[0].connected).toEqual(true);
    expect(groups.allGroups[0].users[1].connected).toEqual(false);
    expect(groups.allGroups[0].users[2].connected).toEqual(true);
    expect(groups.groupForUser("1")).toBe(group);
    expect(groups.userInGroup("1", "1")).toBe(true);
    expect(groups.userInGroup("2", "1")).toBe(true);
    expect(groups.userInGroup("3", "1")).toBe(true);
    expect(groups.userInGroup("4", "1")).toBeFalsy();
    expect(groups.virtualDocumentForGroup("group-1")).toBeDefined();
  });

  it("updates from db", () => {
    const dbGroupsWithoutUsers: DBOfferingGroupMap = {
      1: {
        version: "1.0",
        self: {
          classHash: "test",
          offeringId: "1",
          groupId: "1",
        }
      }
    };
    const dbGroupsWithUsers: DBOfferingGroupMap = {
      1: {
        version: "1.0",
        self: {
          classHash: "test",
          offeringId: "1",
          groupId: "1",
        },
        users: {
          1: {
            version: "1.0",
            self: {
              classHash: "test",
              offeringId: "1",
              groupId: "1",
              uid: "1",
            },
            connectedTimestamp: 1,
          },
          2: { // Old user that doesn't exist in the class anymore
            version: "1.0",
            self: {
              classHash: "test",
              offeringId: "1",
              groupId: "1",
              uid: "2",
            },
            connectedTimestamp: 1,
            disconnectedTimestamp: 2
          },
          3: {  // user without self
            version: "1.0",
            connectedTimestamp: 1,
            disconnectedTimestamp: 2
          } as any,
          4: { // New user that doesn't exist in the class yet
            version: "1.0",
            connectedTimestamp: 2001,
            self: {
              classHash: "test",
              offeringId: "1",
              groupId: "1",
              uid: "4",
            },
          }
        }
      }
    };
    const user = ClassUserModel.create({
      type: "student",
      id: "1",
      firstName: "Test",
      lastName: "User",
      fullName: "Test User",
      initials: "TU"
    });
    const clazz = ClassModel.create({
      name: "test",
      classHash: "test",
      users: {
        1: user
        // don't add student 2 and 4 so we can test missing students
      },
      timestamp: 2000, // Use a fixed timestamp so we can test the New verses Removed user behavior
    });

    const groups = GroupsModel.create({}, {class: clazz});

    groups.updateFromDB(dbGroupsWithoutUsers, clazz);
    expect(groups.allGroups.length).toEqual(1);
    expect(groups.allGroups[0].users.length).toEqual(0);

    groups.updateFromDB(dbGroupsWithUsers, clazz);
    expect(groups.allGroups.length).toEqual(1);
    const group = groups.allGroups[0];
    expect(group.users.length).toEqual(3);
    expect(group.users[0].id).toEqual("1");
    expect(group.users[0].name).toEqual("Test User");
    expect(group.users[0].initials).toEqual("TU");
    expect(group.users[1].id).toEqual("2");
    expect(group.users[1].name).toEqual("Unknown");
    expect(group.users[1].initials).toEqual("??");
    expect(group.users[2].id).toEqual("4");
    expect(group.users[2].name).toEqual("New User");
    expect(group.users[2].initials).toEqual("**");
  });
});
