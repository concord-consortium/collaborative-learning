import { PortalClassOffering, UserModel } from "./user";
import { AuthenticatedUser } from "../../lib/auth";
import { PortalFirebaseStudentJWT } from "../../lib/portal-types";

describe("PortalClassOffering", () => {

  it("defaults to empty", () => {
    const offering = PortalClassOffering.create();
    expect(offering.classId).toBe("");
    expect(offering.classHash).toBe("");
    expect(offering.problemPath).toBe("");
  });

  it("uses override values", () => {
    const kClassId = "class-id";
    const kClassHash = "class-hash";
    const kUnitCode = "unit";
    const kProblemOrdinal = "2.3";
    const offering = PortalClassOffering.create({
                      classId: kClassId,
                      classHash: kClassHash,
                      unitCode: kUnitCode,
                      problemOrdinal: kProblemOrdinal
                    });
    expect(offering.classId).toBe(kClassId);
    expect(offering.classHash).toBe(kClassHash);
    expect(offering.unitCode).toBe(kUnitCode);
    expect(offering.problemOrdinal).toBe(kProblemOrdinal);
    expect(offering.problemPath).toBe(`${kUnitCode}/2/3`);
  });

});

describe("user model", () => {

  it("sets default values", () => {
    const user = UserModel.create({type: "student"});
    expect(user.authenticated).toBe(false);
    expect(user.type).toBe("student");
    expect(user.name).toBe("Anonymous User");
    expect(user.className).toBe("");
    expect(user.latestGroupId).toBeUndefined();
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
    const classHash = "class-hash";
    const authenticatedUser: AuthenticatedUser = {
      type: "student",
      id: "1",
      portal: "test",
      firstName: "Fred",
      lastName: "Flintstone",
      fullName: "Fred Flintstone",
      initials: "FF",
      className: "Bedrock",
      classHash,
      offeringId: "1",
      firebaseJWT: { returnUrl: "https://concord.org/url" } as PortalFirebaseStudentJWT
    };
    user.setAuthenticatedUser(authenticatedUser);
    expect(user.authenticated).toBe(true);
    expect(user.id).toBe(authenticatedUser.id);
    expect(user.name).toBe(authenticatedUser.fullName);
    expect(user.className).toBe(authenticatedUser.className);
    expect(user.latestGroupId).toBe(undefined);
    expect(user.isStudent).toBe(true);
    expect(user.isTeacher).toBe(false);
    expect(user.isNetworkedTeacher).toBe(false);
    expect(user.classHashesForProblemPath("unit/1/2")).toEqual([classHash]);
  });

  it("can set an authenticated teacher user", () => {
    const user = UserModel.create();
    const classHash = "class-hash";
    const activityUrl = "https://concord.org/activity";
    const unitCode = "unit";
    const problemOrdinal = "3.4";
    const offering = PortalClassOffering.create({ offeringId: "1", classHash, activityUrl, unitCode, problemOrdinal });
    const authenticatedUser: AuthenticatedUser = {
      type: "teacher",
      id: "1",
      portal: "test",
      firstName: "Fred",
      lastName: "Flintstone",
      fullName: "Fred Flintstone",
      initials: "FF",
      className: "Bedrock",
      classHash,
      offeringId: "1",
      portalClassOfferings: [offering]
    };
    user.setAuthenticatedUser(authenticatedUser);
    expect(user.authenticated).toBe(true);
    expect(user.id).toBe(authenticatedUser.id);
    expect(user.name).toBe(authenticatedUser.fullName);
    expect(user.className).toBe(authenticatedUser.className);
    expect(user.latestGroupId).toBeUndefined();
    expect(user.isStudent).toBe(false);
    expect(user.isTeacher).toBe(true);
    expect(user.isNetworkedTeacher).toBe(false);
    expect(user.activityUrl).toBe(activityUrl);
    expect(user.classHashesForProblemPath("unit/3/4")).toEqual([classHash]);
  });

  it("can set a demo teacher user", () => {
    const user = UserModel.create();
    const classHash = "class-hash";
    const authenticatedUser: AuthenticatedUser = {
      type: "teacher",
      id: "1",
      portal: "test",
      firstName: "Fred",
      lastName: "Flintstone",
      fullName: "Fred Flintstone",
      initials: "FF",
      className: "Bedrock",
      classHash,
      offeringId: "1",
      demoClassHashes: [classHash]
    };
    user.setAuthenticatedUser(authenticatedUser);
    expect(user.authenticated).toBe(true);
    expect(user.id).toBe(authenticatedUser.id);
    expect(user.name).toBe(authenticatedUser.fullName);
    expect(user.className).toBe(authenticatedUser.className);
    expect(user.latestGroupId).toBeUndefined();
    expect(user.isStudent).toBe(false);
    expect(user.isTeacher).toBe(true);
    expect(user.isNetworkedTeacher).toBe(false);
    expect(user.classHashesForProblemPath("unit/3/4")).toEqual([classHash]);
  });

  it("can set connected status", () => {
    const user = UserModel.create({type: "student"});
    expect(user.isFirebaseConnected).toBe(false);
    expect(user.isLoggingConnected).toBe(false);
    user.setIsFirebaseConnected(true);
    user.setIsLoggingConnected(true);
    expect(user.isFirebaseConnected).toBe(true);
    expect(user.isLoggingConnected).toBe(true);
  });

  it("can set view timestamps", () => {
    const user = UserModel.create({type: "student"});
    expect(user.lastSupportViewTimestamp).toBeUndefined();
    expect(user.lastStickyNoteViewTimestamp).toBeUndefined();
    const timestamp = new Date().getTime();
    user.setLastSupportViewTimestamp(timestamp);
    user.setLastStickyNoteViewTimestamp(timestamp);
    expect(user.lastSupportViewTimestamp).toBe(timestamp);
    expect(user.lastStickyNoteViewTimestamp).toBe(timestamp);
  });
});
