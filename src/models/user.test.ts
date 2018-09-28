import { UserModel } from "./user";
import { AuthenticatedUser } from "../lib/auth";

describe("user model", () => {

  it("sets default values", () => {
    const user = UserModel.create({type: "student"});
    expect(user.authenticated).toBe(false);
    expect(user.type).toBe("student");
    expect(user.name).toBe("Anonymous User");
    expect(user.className).toBe("");
    expect(user.latestGroupId).toBe(undefined);
    expect(user.id).toBe("0");
  });

  it("uses override values", () => {
    const user = UserModel.create({
        authenticated: true,
        type: "student",
        name: "Test User",
        className: "Test Class",
        latestGroupId: "1",
        id: "2",
    });
    expect(user.authenticated).toBe(true);
    expect(user.type).toBe("student");
    expect(user.name).toBe("Test User");
    expect(user.className).toBe("Test Class");
    expect(user.latestGroupId).toBe("1");
    expect(user.id).toBe("2");
    expect(user.initials).toBe("TU");
  });

  it("can change its name", () => {
    const user = UserModel.create({
      name: "Test User",
      type: "student",
      id: "2",
    });
    expect(user.name).toBe("Test User");
    user.setName("Different User");
    expect(user.name).toBe("Different User");
  });

  it("can authenticate", () => {
    const user = UserModel.create();
    user.setAuthenticated(true);
    expect(user.authenticated).toBe(true);
  });

  it("can set a class name", () => {
    const user = UserModel.create();
    const className = "test class";
    user.setClassName(className);
    expect(user.className).toBe(className);
  });

  it("can set a group", () => {
    const user = UserModel.create();
    const group = "1";
    user.setLatestGroupId(group);
    expect(user.latestGroupId).toBe(group);
  });

  it("can set an id", () => {
    const user = UserModel.create();
    const id = "1";
    user.setId(id);
    expect(user.id).toBe(id);
  });

  it("can set an authenticated student user", () => {
    const user = UserModel.create();
    const authenticatedUser: AuthenticatedUser = {
      type: "student",
      id: "1",
      portal: "test",
      firstName: "Fred",
      lastName: "Flintstone",
      fullName: "Fred Flintstone",
      initials: "FF",
      className: "Bedrock",
      classHash: "test",
      offeringId: "1",
    };
    user.setAuthenticatedUser(authenticatedUser);
    expect(user.authenticated).toBe(true);
    expect(user.id).toBe(authenticatedUser.id);
    expect(user.name).toBe(authenticatedUser.fullName);
    expect(user.className).toBe(authenticatedUser.className);
    expect(user.latestGroupId).toBe(undefined);
  });

  it("can set an authenticated teacher user", () => {
    const user = UserModel.create();
    const authenticatedUser: AuthenticatedUser = {
      type: "teacher",
      id: "1",
      portal: "test",
      firstName: "Fred",
      lastName: "Flintstone",
      fullName: "Fred Flintstone",
      initials: "FF",
      className: "Bedrock",
      classHash: "test",
      offeringId: "1",
    };
    user.setAuthenticatedUser(authenticatedUser);
    expect(user.authenticated).toBe(true);
    expect(user.id).toBe(authenticatedUser.id);
    expect(user.name).toBe(authenticatedUser.fullName);
    expect(user.className).toBe(authenticatedUser.className);
    expect(user.latestGroupId).toBe(undefined);
  });
});
