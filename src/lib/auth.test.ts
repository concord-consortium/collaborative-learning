import { assert } from "chai";
import { getPortalJWTWithBearerToken, getClassInfo, authenticate, _private } from "./auth";
import * as nock from "nock";

// tslint:disable-next-line:max-line-length
const RAW_PORTAL_JWT = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbGciOiJIUzI1NiIsImlhdCI6MTUzNTY4NDEyNCwiZXhwIjoxNTM1Njg3NzI0LCJ1aWQiOjQ4MiwiZG9tYWluIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnLyIsInVzZXJfdHlwZSI6ImxlYXJuZXIiLCJ1c2VyX2lkIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnL3VzZXJzLzQ4MiIsImxlYXJuZXJfaWQiOjExNTgsImNsYXNzX2luZm9fdXJsIjoiaHR0cHM6Ly9sZWFybi5zdGFnaW5nLmNvbmNvcmQub3JnL2FwaS92MS9jbGFzc2VzLzEyOCIsIm9mZmVyaW5nX2lkIjo5OTJ9.NTEtF2GR23SzdhE9CCoc_VMcWyb1orb11RhKjdq-st8";

const PORTAL_JWT = {
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

const RAW_CORRECT_STUDENT = {
  id: PORTAL_JWT.user_id,
  first_name: "good first",
  last_name: "good last",
};

const RAW_INCORRECT_STUDENT = {
  id: "bad id",
  first_name: "bad first",
  last_name: "bad last",
};

const RAW_CLASS_INFO = {
  uri: "https://foo.bar",
  name: "test name",
  state: "test state",
  class_hash: "test hash",
  students: [RAW_CORRECT_STUDENT, RAW_INCORRECT_STUDENT ]
};

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
      assert.deepEqual(authenticatedUser, _private.DEV_USER);
      done();
    });
  });

  it("Authenticates externally", (done) => {
    authenticate(false, GOOD_NONCE, PORTAL_DOMAIN).then((authenticatedUser) => {
      assert.deepEqual(authenticatedUser, {
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
        assert(false);
      })
      .catch(() => done());
  });

  it("Fails to authenticate with no token", (done) => {
    authenticate(false, undefined, PORTAL_DOMAIN)
      .then(() => {
        assert(false);
      })
      .catch(() => done());
  });

  it("Fails to authenticate with no domain", (done) => {
    authenticate(false, BAD_NONCE, undefined)
      .then(() => {
        assert(false);
      })
      .catch(() => done());
  });
});
