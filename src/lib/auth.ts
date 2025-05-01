import jwt_decode from "jwt-decode";
import superagent from "superagent";
import initials from "initials";
import { AppMode } from "../models/stores/store-types";
import { QueryParams, urlParams as pageUrlParams } from "../utilities/url-params";
import { NUM_FAKE_STUDENTS, NUM_FAKE_TEACHERS } from "../components/demo/demo-creator";
import { AppConfigModelType } from "../models/stores/app-config-model";
import { UserType } from "../models/stores/user-types";
import { getErrorMessage } from "../utilities/super-agent-helpers";
import { getPortalOfferings, getPortalClassOfferings,  getProblemIdForAuthenticatedUser,
   } from "./portal-api";
import { PortalJWT, PortalFirebaseJWT, PortalUserJWT } from "./portal-types";
import { Logger } from "../lib/logger";
import { LogEventName } from "../lib/logger-types";
import { uniqueId } from "../utilities/js-utils";
import { getUnitCodeFromUnitParam } from "../utilities/url-utils";
import { ICurriculumConfig } from "../models/stores/curriculum-config";
import { ClassInfo, Portal, ResearcherUser, StudentUser, TeacherUser } from "../models/stores/portal";
import { maybeAddResearcherParam } from "../utilities/researcher-param";
import { UserModelType } from "../models/stores/user";

export const PORTAL_JWT_URL_SUFFIX = "api/v1/jwt/portal";
export const FIREBASE_JWT_URL_SUFFIX = "api/v1/jwt/firebase";
export const FIREBASE_APP_NAME = "collaborative-learning";

export const DEV_STUDENT: StudentUser = {
  type: "student",
  id: "1",
  portal: "localhost",
  firstName: "Preview",
  lastName: "Student",
  fullName: "Preview Student",
  initials: "PS",
  className: "Preview Class",
  classHash: "previewclass",
  offeringId: "1",
};

export const DEV_TEACHER: TeacherUser = {
  type: "teacher",
  id: "1000",
  portal: "localhost",
  firstName: "Preview",
  lastName: "Teacher",
  fullName: "Preview Teacher",
  initials: "PT",
  className: "Preview Class",
  classHash: "previewclass",
  offeringId: "1",
};

export const DEV_CLASS_INFO: ClassInfo = {
  name: DEV_STUDENT.className,
  classHash: DEV_STUDENT.classHash,
  students: [DEV_STUDENT],
  teachers: [DEV_TEACHER],
  localTimestamp: Date.now()
};

export type AuthenticatedUser = StudentUser | TeacherUser | ResearcherUser;
export const isAuthenticatedTeacher = (u: AuthenticatedUser): u is TeacherUser => u.type === "teacher";
export const isAuthenticatedResearcher = (u: AuthenticatedUser): u is ResearcherUser => u.type === "researcher";

export interface AuthQueryParams {
  token?: string;
  domain?: string;
}

// An explicitly set appMode takes priority.
// Otherwise, if a token is specified assume "authed" (authentication is likely being tested)
// and otherwise default to "dev" (development mode, also used for anonymous portal preview)
export const getAppMode = (appModeParam?: AppMode, token?: string, host?: string) => {
  return appModeParam != null
           ? appModeParam
           : (token == null ? "dev" : "authed");
};

export const getPortalJWTWithBearerToken = (basePortalUrl: string, type: string, rawToken: string) => {
  return new Promise<[string, PortalJWT]>((resolve, reject) => {
    const resourceLinkIdSuffix =
      pageUrlParams.resourceLinkId ? `?resource_link_id=${ pageUrlParams.resourceLinkId }` : "";
    const url = `${basePortalUrl}${PORTAL_JWT_URL_SUFFIX}${resourceLinkIdSuffix}`;
    superagent
      .get(maybeAddResearcherParam(url))
      .set("Authorization", `${type} ${rawToken}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        } else if (!res.body || !res.body.token) {
          reject("No token found in JWT request response");
        } else {
          const rawJWT = res.body.token;
          const portalJWT = jwt_decode(rawJWT);
          if (portalJWT) {
            resolve([rawJWT, portalJWT as PortalJWT]);
          } else {
            reject("Invalid portal token");
          }
        }
      });
  });
};

export const getFirebaseJWTParams = (classHash?: string) => {
  const params: Record<string,string> = {
    firebase_app: FIREBASE_APP_NAME
  };
  if (classHash) {
    params.class_hash = classHash;
  }
  if (pageUrlParams.resourceLinkId) {
    params.resource_link_id = pageUrlParams.resourceLinkId;
  }
  if (pageUrlParams.targetUserId) {
    params.target_user_id = pageUrlParams.targetUserId;
  }

  return `?${(new URLSearchParams(params)).toString()}`;
};

export const getFirebaseJWTWithBearerToken = (basePortalUrl: string, type: string,
                                              rawToken: string, classHash?: string) => {
  return new Promise<[string, PortalFirebaseJWT]>((resolve, reject) => {
    const url = `${basePortalUrl}${FIREBASE_JWT_URL_SUFFIX}${getFirebaseJWTParams(classHash)}`;
    superagent
      .get(maybeAddResearcherParam(url))
      .set("Authorization", `${type} ${rawToken}`)
      .end((err, res) => {
        if (err) {
          reject(getErrorMessage(err, res));
        }
        else if (!res.body || !res.body.token) {
          reject("No Firebase token found in Firebase JWT request response");
        }
        else {
          const {token} = res.body;
          const firebaseJWT = jwt_decode(token);
          if (firebaseJWT) {
            resolve([token, firebaseJWT as PortalFirebaseJWT]);
          }
          else {
            reject("Invalid Firebase token");
          }
        }
      });
  });
};

interface IAuthenticateResponse {
  appMode?: AppMode;
  authenticatedUser: AuthenticatedUser;
  classInfo?: ClassInfo;
  problemId?: string;
  unitCode?: string;
}

export const authenticate = async (
    appMode: AppMode,
    appConfig: AppConfigModelType,
    curriculumConfig: ICurriculumConfig,
    portalService: Portal,
    urlParams?: QueryParams,
    user?: UserModelType
  ): Promise<IAuthenticateResponse> => {
  urlParams = urlParams || pageUrlParams;

  // if there is an existing JWT (from standalone auth), we are authed
  if (user?.standaloneAuthUser?.jwt) {
    appMode = "authed";
  }

  // TODO: we should be defaulting to appConfig.defaultUnit here rather than the empty string,
  // but some cypress tests rely on the fact that in demo mode the offeringId is prefixed with
  // the unit code, which results in an offeringId of `101` instead of `sas101`.
  const unitCode = urlParams.unit || "";
  // when launched as a report, the params will not contain the problemOrdinal
  const problemOrdinal = urlParams.problem || appConfig.defaultProblemOrdinal;

  let {fakeClass, fakeUser} = urlParams;
  // handle preview launch from portal
  if (portalService.isPortalPreview) {
    appMode = "demo";
    fakeClass = `preview-${urlParams.domain_uid}`;
    fakeUser = `student:${urlParams.domain_uid}`;
  }

  if ((appMode === "demo") || (appMode === "qa")) {
    if (!fakeClass || !fakeUser) {
      throw "Missing fakeClass or fakeUser parameter for demo!";
    }
    let [userType, userId] = fakeUser.split(":");

    if (((userType !== "student") && (userType !== "teacher")) || !userId) {
      throw "fakeUser must be in the form of student:<id> or teacher:<id>";
    }

    if ((userId === "random")) {
      const url = window.location.toString();
      const title = document.title;
      const randomStudentId = uniqueId();
      fakeUser = `student:${randomStudentId}`;
      userId = randomStudentId;
      const newUrl = url.replace(/student:random/, fakeUser);
      window.history.replaceState(title, title, newUrl);
    }

    // respect `network` url parameter in demo/qa modes
    const networkProps = urlParams.network
                          ? { network: urlParams.network, networks: [urlParams.network] }
                          : undefined;
    const fakeOfferingId = createFakeOfferingIdFromProblem(unitCode, problemOrdinal);
    return {
      appMode,
      ...createFakeAuthentication({
          appMode,
          classId: fakeClass,
          userType, userId,
          ...networkProps,
          offeringId: fakeOfferingId
        })
    };
  }

  if (user?.standaloneAuth?.state === "haveBearerToken") {
    const result = await portalService.requestPortalJWT({
      bearerToken: user.standaloneAuth.bearerToken,
      basePortalUrl: user.standaloneAuth.authDomain
    });
    user.setStandaloneAuth({
      state: "authenticated",
      rawPortalJWT: result.rawPortalJWT,
      portalJWT: result.portalJWT as PortalUserJWT
    });
  }

  if (user?.standaloneAuth || appMode !== "authed") {
    return generateDevAuthentication(unitCode || curriculumConfig.defaultUnit || "", problemOrdinal);
  }

  await portalService.initialize(user?.standaloneAuthUser);
  const { portalJWT, rawPortalJWT, basePortalUrl, bearerToken, portalHost } = portalService;

  if (!basePortalUrl || !bearerToken) {
    // Both of these cases should be caught by initialize with more useful error messages
    throw "Invalid Portal Launch";
  }

  const classInfo = await portalService.getClassInfo();
  const { user_type, uid, domain } = portalJWT;
  const { classHash } = classInfo;
  const uidAsString = `${portalJWT.uid}`;
  // TODO: figure out why we need to use bearer tokens here in normal mode
  // when we already have the portalJWT in all cases
  const tokenType = user?.standaloneAuthUser ? "Bearer/JWT" : "Bearer";
  const rawToken = user?.standaloneAuthUser?.rawJWT ?? bearerToken;
  const firebaseJWTPromise = getFirebaseJWTWithBearerToken(basePortalUrl, tokenType, rawToken, classHash);
  const portalOfferingsPromise = getPortalOfferings(user_type, uid, domain, rawPortalJWT);
  const problemIdPromise = getProblemIdForAuthenticatedUser(rawPortalJWT, curriculumConfig, urlParams);

  const [firebaseJWTResult, portalOfferingsResult, problemIdResult] =
    await Promise.all([firebaseJWTPromise, portalOfferingsPromise, problemIdPromise]);

  const [rawFirebaseJWT, firebaseJWT] = firebaseJWTResult;
  const { unitCode: newUnitCode, problemOrdinal: newProblemOrdinal } = problemIdResult;

  let fullName: string;
  let authenticatedUser: StudentUser | TeacherUser | ResearcherUser | undefined = undefined;
  switch (user_type) {
    case "learner":
      authenticatedUser = classInfo.students.find(student => student.id === uidAsString);
      break;
    case "teacher":
      authenticatedUser = classInfo.teachers.find(teacher => teacher.id === uidAsString);
      break;
    case "researcher":
      fullName = `${portalJWT.first_name} ${portalJWT.last_name}`;
      authenticatedUser = {
        type: "researcher",
        id: uidAsString,
        portal: portalHost,
        firstName: portalJWT.first_name,
        lastName: portalJWT.last_name,
        fullName,
        className: classInfo.name,
        initials: initials(fullName) as string,
        classHash: classInfo.classHash,
        offeringId: portalService.offeringId
      };
      break;
    default:
      throw new Error(`Unsupported user type: ${user_type ?? "(unknown user type)"}`);
  }

  if (!authenticatedUser) {
    throw new Error("Current user not found in class roster or is not a researcher");
  }

  authenticatedUser.portalJWT = portalJWT;
  authenticatedUser.rawPortalJWT = rawPortalJWT;
  authenticatedUser.firebaseJWT = firebaseJWT;
  authenticatedUser.rawFirebaseJWT = rawFirebaseJWT;
  authenticatedUser.id = uidAsString;
  authenticatedUser.portal = portalHost;
  authenticatedUser.portalClassOfferings =
    getPortalClassOfferings(portalOfferingsResult, appConfig, curriculumConfig, urlParams);

  Logger.log(LogEventName.INTERNAL_AUTHENTICATED, {id: authenticatedUser.id, portal: portalHost});

  return {
    appMode,
    authenticatedUser,
    classInfo,
    unitCode: newUnitCode,
    problemId: newProblemOrdinal
  };
};

export const generateDevAuthentication = (unitCode: string, problemOrdinal: string) => {
  const offeringId = createFakeOfferingIdFromProblem(unitCode, problemOrdinal);
  DEV_STUDENT.offeringId = offeringId;
  DEV_CLASS_INFO.students.forEach((student) => student.offeringId = offeringId);
  DEV_CLASS_INFO.teachers.forEach((teacher) => teacher.offeringId = offeringId);

  let authenticatedUser: AuthenticatedUser = DEV_STUDENT;

  const fakeUser = pageUrlParams.fakeUser;
  if (fakeUser) {
    const [role, fakeId] = fakeUser.split(":");
    if (role === "teacher") {
      authenticatedUser = DEV_TEACHER;
      fakeId && (DEV_TEACHER.id = fakeId);

      // respect `network` url parameter in dev mode
      if (pageUrlParams.network) {
        authenticatedUser.network = pageUrlParams.network;
        authenticatedUser.networks = [pageUrlParams.network];
      }
    }
    else {
      fakeId && (DEV_STUDENT.id = fakeId);
    }
  }

  return {authenticatedUser, classInfo: DEV_CLASS_INFO};
};

export const createFakeOfferingIdFromProblem = (unitParam: string, problemOrdinal: string) => {
  // create fake offeringIds per problem so we keep section documents separate
  const [major, minor] = problemOrdinal.split(".");
  const toNumber = (s: string, fallback: number) => isNaN(parseInt(s, 10)) ? fallback : parseInt(s, 10);
  // Ideally we'd get the unit code from the loaded unit data, but we don't have the unit data
  // yet, and it would complicate things to wait for it to load.
  const offeringPrefix = getUnitCodeFromUnitParam(unitParam);
  return `${offeringPrefix}${(toNumber(major, 1) * 100) + toNumber(minor, 0)}`;
};

export interface CreateFakeUserOptions {
  appMode: AppMode;
  classId: string;
  userType: UserType;
  userId: string;
  network?: string;
  offeringId: string;
}

const getFakeClassHash = (appMode: AppMode, classId: string) => {
  return `${appMode}class${classId}`;
};

// for testing purposes, demo teachers each have access to three classes
const getFakeTeacherClassHashes = (appMode: AppMode, classId: string) => {

  // if class id is non-numeric, just return the teacher's own class hash
  const idNum = parseInt(classId, 10);
  if (isNaN(idNum)) return [getFakeClassHash(appMode, classId)];

  // each block of three classes is considered part of the same group,
  // e.g. [class1, class2, class3], [class4, class5, class6], etc.
  const mod3 = (idNum - 1) % 3;
  const idNumBase = idNum - mod3;
  return [idNumBase, idNumBase + 1, idNumBase + 2]
          .map(id => getFakeClassHash(appMode, `${id}`));
};

export const createFakeUser = (options: CreateFakeUserOptions) => {
  const {appMode, classId, userType, userId, network, offeringId} = options;
  const className = `${appMode === "demo" ? "Demo" : "QA"} Class ${classId}`;
  if (userType === "student") {
    const student: StudentUser = {
      type: "student",
      id: userId,
      portal: appMode,
      firstName: "Student",
      lastName: `${userId}`,
      fullName: `Student ${userId}`,
      initials: `S${userId}`,
      className,
      classHash: getFakeClassHash(appMode, classId),
      offeringId,
    };
    return student;
  }
  else {
    const teacher: TeacherUser = {
      type: "teacher",
      id: `${parseInt(userId, 10) + 1000}`,
      portal: appMode,
      firstName: "Teacher",
      lastName: `${userId}`,
      fullName: `Teacher ${userId}`,
      initials: `T${userId}`,
      network,
      className,
      classHash: getFakeClassHash(appMode, classId),
      demoClassHashes: getFakeTeacherClassHashes(appMode, classId),
      offeringId,
    };
    return teacher;
  }
};

export interface CreateFakeAuthenticationOptions {
  appMode: AppMode;
  classId: string;
  userType: UserType;
  userId: string;
  network?: string;
  offeringId: string;
}

export const createFakeAuthentication = (options: CreateFakeAuthenticationOptions) => {
  const {appMode, classId, userType, userId, network: _network, offeringId} = options;
  const network = userType === "teacher"
                    ? _network || (parseInt(userId, 10) > 1 ? "demo-network" : undefined) || undefined
                    : undefined;
  const authenticatedUser = createFakeUser({appMode, classId, userType, network, userId, offeringId});
  const classInfo: ClassInfo = {
    name: authenticatedUser.className,
    classHash: authenticatedUser.classHash,
    students: [],
    teachers: [],
    localTimestamp: Date.now()
  };
  // Add the random student to the class first and then fill the class
  // FIXME: It looks like if the teacher id is not 1,2,3 then the teacher won't
  // be added to the class.
  classInfo.students.push(
    createFakeUser({
      appMode,
      classId,
      userType: "student",
      userId: `${userId}`,
      offeringId
    }) as StudentUser
  );
  for (let i = 1; i <= NUM_FAKE_STUDENTS; i++) {
    if (i.toString() !== userId) {
      classInfo.students.push(
        createFakeUser({
          appMode,
          classId,
          userType: "student",
          userId: `${i}`,
          offeringId
        }) as StudentUser
      );
    }
  }

  for (let i = 1; i <= NUM_FAKE_TEACHERS; i++) {
    classInfo.teachers.push(
      createFakeUser({
        appMode,
        classId,
        userType: "teacher",
        userId: `${i}`,
        // teacher 1 is solo; others are networked
        network: i > 1 ? "demo-network" : undefined,
        offeringId
      }) as TeacherUser
    );
  }
  return {authenticatedUser, classInfo};
};
