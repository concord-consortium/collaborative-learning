import { GroupsModel, GroupModel, GroupUserModel } from "./groups";
import { ClassModel, ClassStudentModel } from "./class";
import { DBOfferingGroupMap } from "../../lib/db-types";

describe("Groups model", () => {

  it("has default values", () => {
    const groups = GroupsModel.create({});
    expect(groups.allGroups).toEqual([]);
    expect(groups.groupForUser("1")).toBe(undefined);
  });

  it("uses override values", () => {
    const group = GroupModel.create({
      id: "1",
      users: [
        GroupUserModel.create({
          id: "1",
          name: "User 1",
          initials: "U1",
          connectedTimestamp: 1,
        }),
        GroupUserModel.create({
          id: "2",
          name: "User 2",
          initials: "U2",
          connectedTimestamp: 1,
          disconnectedTimestamp: 2,
        }),
        GroupUserModel.create({
          id: "3",
          name: "User 3",
          initials: "U3",
          connectedTimestamp: 3,
          disconnectedTimestamp: 2,
        }),
      ],
    });
    const groups = GroupsModel.create({
      allGroups: [group]
    });
    expect(groups.allGroups).toEqual([group]);
    expect(groups.allGroups[0].users).toEqual(group.users);
    expect(groups.allGroups[0].users[0].connected).toEqual(true);
    expect(groups.allGroups[0].users[1].connected).toEqual(false);
    expect(groups.allGroups[0].users[2].connected).toEqual(true);
    expect(groups.groupForUser("1")).toBe(group);
  });

  it("updates from db", () => {
    const groups = GroupsModel.create({});
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
          2: {
            version: "1.0",
            self: {
              classHash: "test",
              offeringId: "1",
              groupId: "1",
              uid: "2",
            },
            connectedTimestamp: 1,
            disconnectedTimestamp: 2
          }
        }
      }
    };
    const clazz = ClassModel.create({
      name: "test",
      classHash: "test",
      students: [
        ClassStudentModel.create({
          id: "1",
          firstName: "Test",
          lastName: "User",
          fullName: "Test User",
          initials: "TU"
        }),
        // don't add student 2 so we can test missing students
      ]
    });

    groups.updateFromDB("1", dbGroupsWithoutUsers, clazz);
    expect(groups.allGroups.length).toEqual(1);
    expect(groups.allGroups[0].users.length).toEqual(0);

    groups.updateFromDB("1", dbGroupsWithUsers, clazz);
    expect(groups.allGroups.length).toEqual(1);
    expect(groups.allGroups[0].users.length).toEqual(2);
    expect(groups.allGroups[0].users[0].id).toEqual("1");
  });
});
