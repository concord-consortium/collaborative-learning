import {AuthData} from "firebase-functions/lib/common/providers/https";
import {IUserContext} from "../../shared/shared";
import {getFirebaseClassPath, validateUserContext} from "../src/user-context";
import {
  kCanonicalPortal, kClassHash, kDemoName, kFirebaseUserId, kOtherCanonicalPortal, kOtherClaimPortal, kOtherClassHash,
  kOtherDemoName, kOtherFirebaseUserId, kOtherPlatformUserId, kOtherPortal, kOtherUserId, specAuth, specUserContext,
} from "./test-utils";

describe("UserContext", () => {
  describe("getFirebaseClassPath", () => {
    const classPathContainsAll = (context: IUserContext, auth: AuthData, testStrs: string[]) => {
      const classPath = getFirebaseClassPath(context, auth);
      return testStrs.every((str) => classPath.includes(str));
    };

    it("should return empty paths for invalid/incomplete/inconsistent information", () => {
      expect(getFirebaseClassPath(specUserContext({appMode: "foo"}))).toBeFalsy();
      expect(getFirebaseClassPath(specUserContext({}, ["appMode"]))).toBeFalsy();
      expect(getFirebaseClassPath(specUserContext({}, ["portal"]))).toBeFalsy();
      expect(getFirebaseClassPath(specUserContext({}, ["classHash"]))).toBeFalsy();
      // we don't need the uid to construct a classPath for an authenticated or demo user
      expect(getFirebaseClassPath(specUserContext({}, ["uid"]))).toBeTruthy();
      expect(getFirebaseClassPath(specUserContext({appMode: "demo"}, ["uid"]))).toBeTruthy();
      // we do need the uid to construct a classPath for dev/qa/test users
      expect(getFirebaseClassPath(specUserContext({appMode: "dev"}, ["uid"]))).toBeFalsy();
      expect(getFirebaseClassPath(specUserContext({appMode: "qa"}, ["uid"]))).toBeFalsy();
      expect(getFirebaseClassPath(specUserContext({appMode: "test"}, ["uid"]))).toBeFalsy();
    });

    it("should return valid class paths when appropriate", () => {
      expect(classPathContainsAll(specUserContext(), specAuth(),
        ["/authed", kCanonicalPortal, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({portal: kOtherPortal}), specAuth(),
        ["/authed", kOtherCanonicalPortal, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "demo"}), specAuth(),
        ["/demo", kDemoName, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "demo", demoName: "foo-bar"}), specAuth(),
        ["/demo", "foo-bar"])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "dev"}), specAuth(),
        ["/dev", kFirebaseUserId, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "dev", uid: kOtherUserId}),
        specAuth({uid: kOtherFirebaseUserId}),
        ["/dev", kOtherFirebaseUserId, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "qa"}), specAuth(),
        ["/qa", kFirebaseUserId, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "qa", uid: kOtherUserId}),
        specAuth({uid: kOtherFirebaseUserId}),
        ["/qa", kOtherUserId, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "test"}), specAuth(),
        ["/test", kFirebaseUserId, kClassHash])).toBe(true);
      expect(classPathContainsAll(specUserContext({appMode: "test", uid: kOtherUserId}),
        specAuth({uid: kOtherFirebaseUserId}),
        ["/test", kOtherFirebaseUserId, kClassHash])).toBe(true);
    });
  });

  describe("validateUserContext", () => {
    it("should return isValid: false for invalid/incomplete/inconsistent information", () => {
      expect(validateUserContext(specUserContext({appMode: "foo"})).isValid).toBe(false);
      expect(validateUserContext(specUserContext()).isValid).toBe(false);
      expect(validateUserContext(specUserContext({}, ["appMode"]), specAuth()).isValid).toBe(false);
      expect(validateUserContext(specUserContext({}, ["portal"]), specAuth()).isValid).toBe(false);
      expect(validateUserContext(specUserContext({}, ["classHash"]), specAuth()).isValid).toBe(false);
      // we don't need the uid to construct a classPath for an authenticated or demo user
      expect(validateUserContext(specUserContext({}, ["uid"]), specAuth()).isValid).toBe(true);
      expect(validateUserContext(specUserContext({appMode: "demo"}, ["uid"])).isValid).toBe(true);
      // we do need the uid to construct a classPath for dev/qa/test users
      expect(validateUserContext(specUserContext({appMode: "dev"}, ["uid"])).isValid).toBe(false);
      expect(validateUserContext(specUserContext({appMode: "qa"}, ["uid"])).isValid).toBe(false);
      expect(validateUserContext(specUserContext({appMode: "test"}, ["uid"])).isValid).toBe(false);
    });

    it("should return isValid: false for authenticated users whose claims don't match", () => {
      expect(validateUserContext(specUserContext(),
        specAuth({token: {platform_id: kOtherClaimPortal}})).isValid).toBe(false);
      expect(validateUserContext(specUserContext(),
        specAuth({token: {platform_user_id: kOtherPlatformUserId}})).isValid).toBe(false);
      expect(validateUserContext(specUserContext(),
        specAuth({token: {class_hash: kOtherClassHash}})).isValid).toBe(false);
    });

    it("should return isValid: true when appropriate", () => {
      expect(validateUserContext(specUserContext(), specAuth()).isValid).toBe(true);
      expect(validateUserContext(specUserContext(), specAuth()).classPath).toBeTruthy();
      expect(validateUserContext(specUserContext({appMode: "demo"})).isValid).toBe(true);
      expect(validateUserContext(specUserContext({appMode: "demo"})).classPath).toBeTruthy();
      expect(validateUserContext(specUserContext({appMode: "demo", demoName: kOtherDemoName})).isValid).toBe(true);
      expect(validateUserContext(specUserContext({appMode: "demo", demoName: kOtherDemoName})).classPath).toBeTruthy();
      expect(validateUserContext(specUserContext({appMode: "dev"}), specAuth()).isValid).toBe(true);
      expect(validateUserContext(specUserContext({appMode: "dev"}), specAuth()).classPath).toBeTruthy();
      expect(validateUserContext(specUserContext({appMode: "qa"}), specAuth()).isValid).toBe(true);
      expect(validateUserContext(specUserContext({appMode: "qa"}), specAuth()).classPath).toBeTruthy();
      expect(validateUserContext(specUserContext({appMode: "test"}), specAuth()).isValid).toBe(true);
      expect(validateUserContext(specUserContext({appMode: "test"}), specAuth()).classPath).toBeTruthy();
    });
  });
});
