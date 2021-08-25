import { AuthData } from "firebase-functions/lib/common/providers/https";
import { DeepPartial } from "utility-types";
import { IUserContext } from "../src/shared-types";

export const kPortal = "https://test.portal";
export const kCanonicalPortal = "test_portal";
export const kOtherPortal = "https://other.test.portal";
export const kCanonicalOtherPortal = "other_test_portal";
export const kDemoName = "demo-name";
export const kOtherDemoName = "demo-name";
export const kPlatformUserId = 123456;
export const kUserId = `${kPlatformUserId}`;
export const kFirebaseUserId = `fb-${kUserId}`;
export const kOtherPlatformUserId = 654321;
export const kOtherUserId = `${kOtherPlatformUserId}`;
export const kOtherFirebaseUserId = `fb-${kOtherUserId}`;
export const kClassHash = "class-hash";
export const kOtherClassHash = "other-class-hash";
export const kOfferingId = "offering-id";
export const kTeacherName = "Jane Teacher";
export const kOtherTeacherName = "John Teacher";
export const kTeacherNetwork = "teacher-network";
export const kOtherTeacherNetwork = "other-network";
export const kDocumentType = "problem";
export const kDocumentKey = "document-key";
export const kCreatedAt = Date.now();


export const specUserContext = (overrides?: Partial<IUserContext>, exclude?: string[]): IUserContext => {
  // default to authed mode unless another mode specified
  const appMode = overrides?.appMode || "authed";
  const demoName = overrides?.appMode === "demo" ? overrides?.demoName || kDemoName : undefined;
  const portal = overrides?.portal || kPortal;
  const classHash = overrides?.classHash || kClassHash;
  const context: IUserContext = {
    appMode,
    demoName,
    portal,
    uid: kUserId,
    type: "teacher",
    name: kTeacherName,
    network: kTeacherNetwork,
    classHash,
    teachers: [kUserId],
    // include argument overrides defaults
    ...overrides
  };
  // exclude specified properties from result
  exclude?.forEach(prop => {
    delete (context as any)[prop];
  });
  return context;
};

export const specAuth = (overrides?: DeepPartial<AuthData>, exclude?: string[]): AuthData => {
  const portal = overrides?.token?.platform_id || kPortal;
  const userId = overrides?.token?.platform_user_id || kPlatformUserId;
  const classHash = overrides?.token?.class_hash || kClassHash;
  const userType = overrides?.token?.user_type === "teacher" ? overrides.token.user_type : "learner";
  const offeringId = userType === "teacher" ? undefined : overrides?.token?.offering_id || kOfferingId;
  return {
    uid: overrides?.uid || kFirebaseUserId,
    token: {
      user_id: `${portal}/${userId}`,
      class_hash: classHash,
      platform_id: portal,
      platform_user_id: userId,
      user_type: userType,
      offeringId
    } as any
  };
};
