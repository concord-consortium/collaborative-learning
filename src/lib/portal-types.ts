export type UserType = "student" | "teacher";

export type PortalJWT = PortalStudentJWT | PortalTeacherJWT | PortalUserJWT;

export interface BasePortalJWT {
  alg: string;
  iat: number;
  exp: number;
  uid: number;
}

export interface PortalStudentJWT extends BasePortalJWT {
  domain: string;
  user_type: "learner";
  user_id: string;
  learner_id: number;
  class_info_url: string;
  offering_id: number;
}

export interface PortalTeacherJWT extends BasePortalJWT {
  domain: string;
  user_type: "teacher";
  user_id: string;
  teacher_id: number;
}

export interface PortalUserJWT extends BasePortalJWT {
  domain: string;
  user_type: "user";
  user_id: string;
  first_name: string;
  last_name: string;
}

// firebase JWT claims are available to firestore security rules under request.auth.token
export interface PortalFirebaseJWTBaseClaims {
  user_id: string;          // e.g. `https://learn.concord.org/users/${platform_user_id}`
  class_hash: string;
  platform_id: string;      // e.g. "https://learn.concord.org"
  platform_user_id: number;
}

export interface PortalFirebaseJWTStudentClaims extends PortalFirebaseJWTBaseClaims {
  user_type: "learner";
  offering_id: number;
}

export interface PortalFirebaseJWTTeacherClaims extends PortalFirebaseJWTBaseClaims {
  user_type: "teacher";
}

export type PortalFirebaseJWTClaims = PortalFirebaseJWTStudentClaims | PortalFirebaseJWTTeacherClaims;

export interface BasePortalFirebaseJWT {
  alg: string;
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  uid: string;
  user_id: string;
}

export interface PortalFirebaseStudentJWT extends BasePortalFirebaseJWT {
  domain: string;
  domain_uid: number;
  externalId: number;
  returnUrl: string;
  logging: boolean;
  class_info_url: string;
  claims: PortalFirebaseJWTStudentClaims;
}

export interface PortalFirebaseTeacherJWT extends BasePortalFirebaseJWT {
  domain: string;
  domain_uid: number;
  claims: PortalFirebaseJWTTeacherClaims;
}

export type PortalFirebaseJWT = PortalFirebaseStudentJWT | PortalFirebaseTeacherJWT;
