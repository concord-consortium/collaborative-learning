export type UserType = "student" | "teacher";

export interface IPortalReport {
  url: string;
  name: string;
  id: number;
}

// The portal's native format of offerings API returns
export interface IPortalOffering {
  id: number;
  clazz: string;
  clazz_id: number;
  clazz_hash?: string;  // added in recent portal versions
  clazz_info_url: string;
  activity: string;
  activity_url: string;
  external_report?: IPortalReport | null;
  external_reports?: IPortalReport[];
  teacher: string;
}

// portal's offerings format from classes API returns
export interface IPortalClassOffering {
  id: number;
  name: string;
  url: string;
  external_url: string;
  active: boolean;
  locked: boolean;
}

export interface IPortalClassUser {
  id: string;               // e.g. "https://learn.staging.concord.org/users/5445"
  user_id: number;          // e.g. 5445
  first_name: string;
  last_name: string;
}

// format of portal's `classes` api response
export interface IPortalClassInfo {
  id: number;               // e.g. 553
  uri: string;              // "https://learn.staging.concord.org/api/v1/classes/553"
  name: string;
  class_hash: string;
  class_word: string;
  teachers: IPortalClassUser[];
  students: IPortalClassUser[];
  offerings: IPortalClassOffering[];
}

export type PortalJWT = PortalStudentJWT | PortalTeacherJWT | PortalUserJWT | PortalResearcherJWT;

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

export interface PortalResearcherJWT extends BasePortalJWT {
  domain: string;
  user_type: "researcher";
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface PortalUserJWT extends BasePortalJWT {
  domain: string;
  user_type: "user";
  user_id: string;
  first_name: string;
  last_name: string;
  teacher: boolean;
  student: boolean;
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
