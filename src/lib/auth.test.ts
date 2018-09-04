import { authenticate, _private, PortalJWT, RawUser, RawClassInfo, getDevMode } from "./auth";
import * as nock from "nock";

// tslint:disable-next-line:max-line-length
const RAW_PORTAL_JWT: string = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbGciOiJIUzI1NiIsImlhdCI6MTUzNTY4NDEyNCwiZXhwIjoxNTM1Njg3NzI0LCJ1aWQiOjQ4MiwiZG9tYWluIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnLyIsInVzZXJfdHlwZSI6ImxlYXJuZXIiLCJ1c2VyX2lkIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnL3VzZXJzLzQ4MiIsImxlYXJuZXJfaWQiOjExNTgsImNsYXNzX2luZm9fdXJsIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnL2FwaS92MS9jbGFzc2VzLzEyOCIsIm9mZmVyaW5nX2lkIjo5OTJ9.NTEtF2GR23SzdhE9CCoc_VMcWyb1orb11RhKjdq-st8";

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

const GOOD_NONCE: string = "goodNonce";
const BAD_NONCE: string = "badNonce";

const PORTAL_DOMAIN: string = "http://portal/";

const CLASS_INFO_URL: string = "https://learn.staging.concord.org/api/v1/classes/128";

const RAW_CORRECT_STUDENT: RawUser = {
  id: PORTAL_JWT.user_id,
  first_name: "good first",
  last_name: "good last",
};

const RAW_INCORRECT_STUDENT: RawUser = {
  id: "bad id",
  first_name: "bad first",
  last_name: "bad last",
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
    const mode = getDevMode(undefined, undefined, "localhost");
    expect(mode).toBe(true);
  });

  it("should not be in dev mode if authentication is being tested", () => {
    const mode = getDevMode(undefined, "testToken", "localhost");
    expect(mode).toBe(false);
  });

  it("should not be in dev mode by default in production", () => {
    const mode = getDevMode(undefined, undefined, "learning.concord.org");
    expect(mode).toBe(false);
  });

  it("should use the dev mode parameter if it's specified", () => {
    const trueMode = getDevMode("true", undefined, "learning.concord.org");
    expect(trueMode).toBe(true);

    const falseMode = getDevMode("false", undefined, "localhost");
    expect(falseMode).toBe(false);
  });
});

describe("authentication", () => {

  beforeEach(() => {
    nock((PORTAL_DOMAIN + _private.PORTAL_JWT_URL_SUFFIX), {
      reqheaders: {
        Authorization: `Bearer ${GOOD_NONCE}`
      }
    })
    .get("")
    .reply(200, {
      token: RAW_PORTAL_JWT,
    });

    nock((PORTAL_DOMAIN + _private.PORTAL_JWT_URL_SUFFIX), {
      reqheaders: {
        Authorization: `Bearer ${BAD_NONCE}`
      }
    })
    .get("")
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
    authenticate(true).then((authenticatedUser) => {
      expect(authenticatedUser).toEqual(_private.DEV_USER);
      done();
    });
  });

  it("Authenticates externally", (done) => {
    authenticate(false, GOOD_NONCE, PORTAL_DOMAIN).then((authenticatedUser) => {
      expect(authenticatedUser).toEqual({
        type: "student",
        id: PORTAL_JWT.user_id,
        firstName: RAW_CORRECT_STUDENT.first_name,
        lastName: RAW_CORRECT_STUDENT.last_name,
        fullName: `${RAW_CORRECT_STUDENT.first_name} ${RAW_CORRECT_STUDENT.last_name}`,
        className: RAW_CLASS_INFO.name
      });
      done();
    });
  });

  it("Fails to authenticate with a bad nonce", (done) => {
    authenticate(false, BAD_NONCE, PORTAL_DOMAIN)
      .then(() => {
        done.fail();
      })
      .catch(() => done());
  });

  it("Fails to authenticate with no token", (done) => {
    authenticate(false, undefined, PORTAL_DOMAIN)
      .then(() => {
        done.fail();
      })
      .catch(() => done());
  });

  it("Fails to authenticate with no domain", (done) => {
    authenticate(false, BAD_NONCE, undefined)
      .then(() => {
        done.fail();
      })
      .catch(() => done());
  });
});
