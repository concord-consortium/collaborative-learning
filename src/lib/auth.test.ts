import { authenticate, _private, PortalJWT, RawUser, RawClassInfo, getAppMode } from "./auth";
import * as nock from "nock";

const { FIREBASE_JWT_QUERY, FIREBASE_JWT_URL_SUFFIX, PORTAL_JWT_URL_SUFFIX } = _private;

// tslint:disable-next-line:max-line-length
const RAW_PORTAL_JWT = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbGciOiJIUzI1NiIsImlhdCI6MTUzNTY4NDEyNCwiZXhwIjoxNTM1Njg3NzI0LCJ1aWQiOjQ4MiwiZG9tYWluIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnLyIsInVzZXJfdHlwZSI6ImxlYXJuZXIiLCJ1c2VyX2lkIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnL3VzZXJzLzQ4MiIsImxlYXJuZXJfaWQiOjExNTgsImNsYXNzX2luZm9fdXJsIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnL2FwaS92MS9jbGFzc2VzLzEyOCIsIm9mZmVyaW5nX2lkIjo5OTJ9.NTEtF2GR23SzdhE9CCoc_VMcWyb1orb11RhKjdq-st8";
// tslint:disable-next-line:max-line-length
const RAW_FIREBASE_JWT = RAW_PORTAL_JWT;

const PORTAL_JWT: PortalJWT = {
  alg: "HS256",
  iat: 1535684124,
  exp: 1535687724,
  uid: 482,
  domain: "https://learn.staging.concord.org/",
  user_type: "learner",
  user_id: "https://learn.staging.concord.org/users/482",
  learner_id: 1158,
  class_info_url: "https://learn.staging.concord.org/api/v1/classes/128",
  offering_id: 992
};

const GOOD_NONCE = "goodNonce";
const BAD_NONCE = "badNonce";

const PORTAL_DOMAIN = "http://portal/";

const CLASS_INFO_URL = "https://learn.staging.concord.org/api/v1/classes/128";

const RAW_CORRECT_STUDENT: RawUser = {
  id: PORTAL_JWT.user_id,
  first_name: "GoodFirst",
  last_name: "GoodLast",
};

const RAW_INCORRECT_STUDENT: RawUser = {
  id: "bad id",
  first_name: "BadFirst",
  last_name: "BadLast",
};

const RAW_CLASS_INFO: RawClassInfo = {
  uri: "https://foo.bar",
  name: "test name",
  state: "test state",
  class_hash: "test hash",
  students: [RAW_CORRECT_STUDENT, RAW_INCORRECT_STUDENT ],
  teachers: [],
};

describe("dev mode", () => {
  it("should be in dev mode on a local machine", () => {
    const mode = getAppMode(undefined, undefined, "localhost");
    expect(mode).toBe("dev");
  });

  it("should not be in dev mode if authentication is being tested", () => {
    const mode = getAppMode(undefined, "testToken", "localhost");
    expect(mode).toBe("authed");
  });

  it("should not be in dev mode by default in production", () => {
    const mode = getAppMode(undefined, undefined, "learning.concord.org");
    expect(mode).toBe("authed");
  });

  it("should use the dev mode parameter if it's specified", () => {
    const trueMode = getAppMode("dev", undefined, "learning.concord.org");
    expect(trueMode).toBe("dev");
  });
});

describe("authentication", () => {

  beforeEach(() => {
    nock((PORTAL_DOMAIN + PORTAL_JWT_URL_SUFFIX), {
      reqheaders: {
        Authorization: `Bearer ${GOOD_NONCE}`
      }
    })
    .get("")
    .reply(200, {
      token: RAW_PORTAL_JWT,
    });

    nock((PORTAL_DOMAIN + PORTAL_JWT_URL_SUFFIX), {
      reqheaders: {
        Authorization: `Bearer ${BAD_NONCE}`
      }
    })
    .get("")
    .reply(400);

    nock((PORTAL_DOMAIN + FIREBASE_JWT_URL_SUFFIX), {
      reqheaders: {
        Authorization: `Bearer ${GOOD_NONCE}`
      }
    })
    .get(FIREBASE_JWT_QUERY)
    .reply(200, {
      token: RAW_FIREBASE_JWT,
    });

    nock((PORTAL_DOMAIN + FIREBASE_JWT_URL_SUFFIX), {
      reqheaders: {
        Authorization: `Bearer ${BAD_NONCE}`
      }
    })
    .get(FIREBASE_JWT_QUERY)
    .reply(400);

    nock(CLASS_INFO_URL, {
      reqheaders: {
        Authorization: `Bearer/JWT ${RAW_PORTAL_JWT}`
      }
    })
    .get("")
    .reply(200, RAW_CLASS_INFO);
  });

  it("Authenticates as a developer", (done) => {
    authenticate("dev").then((authenticatedUser) => {
      expect(authenticatedUser).toEqual(_private.DEV_USER);
      done();
    });
  });

  it("Authenticates externally", (done) => {
    authenticate("authed", GOOD_NONCE, PORTAL_DOMAIN).then((authenticatedUser) => {
      expect(authenticatedUser).toEqual({
        type: "student",
        id: PORTAL_JWT.uid,
        firstName: RAW_CORRECT_STUDENT.first_name,
        lastName: RAW_CORRECT_STUDENT.last_name,
        fullName: `${RAW_CORRECT_STUDENT.first_name} ${RAW_CORRECT_STUDENT.last_name}`,
        initials: "GG",
        className: RAW_CLASS_INFO.name,
        classHash: "test hash",
        offeringId: "992",
        portalJWT: {
          alg: "HS256",
          class_info_url: "https://learn.staging.concord.org/api/v1/classes/128",
          domain: "https://learn.staging.concord.org/",
          exp: 1535687724,
          iat: 1535684124,
          learner_id: 1158,
          offering_id: 992,
          uid: 482,
          user_id: "https://learn.staging.concord.org/users/482",
          user_type: "learner",
        },
        firebaseJWT: {
          alg: "HS256",
          class_info_url: "https://learn.staging.concord.org/api/v1/classes/128",
          domain: "https://learn.staging.concord.org/",
          exp: 1535687724,
          iat: 1535684124,
          learner_id: 1158,
          offering_id: 992,
          uid: 482,
          user_id: "https://learn.staging.concord.org/users/482",
          user_type: "learner",
        },
        rawPortalJWT: RAW_PORTAL_JWT,
        rawFirebaseJWT: RAW_FIREBASE_JWT,
      });
      done();
    })
    .catch(done);
  });

  it("Fails to authenticate with a bad nonce", (done) => {
    authenticate("authed", BAD_NONCE, PORTAL_DOMAIN)
      .then(() => {
        done.fail();
      })
      .catch(() => done());
  });

  it("Fails to authenticate with no token", (done) => {
    authenticate("authed", undefined, PORTAL_DOMAIN)
      .then(() => {
        done.fail();
      })
      .catch(() => done());
  });

  it("Fails to authenticate with no domain", (done) => {
    authenticate("authed", BAD_NONCE, undefined)
      .then(() => {
        done.fail();
      })
      .catch(() => done());
  });
});
