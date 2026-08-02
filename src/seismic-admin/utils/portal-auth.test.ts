import {
  attemptAutoLogin, buildAuthorizeUrl, clearLastLogin, consumeAccessTokenFromLocation, fetchTokenServiceJwt,
  getPortalUrl, getTokenServiceEnv, shouldAutoLogin, AUTO_LOGIN_MAX_AGE_MS
} from "./portal-auth";

const LAST_LOGIN_KEY = "seismic-admin-portal-last-login";

describe("portal-auth", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/seismic-admin/");
  });

  const saveRecord = (portal: string, time: number) =>
    localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ portal, time }));

  describe("getPortalUrl", () => {
    it("defaults to learn.concord.org", () => {
      expect(getPortalUrl()).toBe("https://learn.concord.org");
    });

    it("honors a bare host in the portal param", () => {
      history.replaceState(null, "", "/seismic-admin/?portal=learn.staging.concord.org");
      expect(getPortalUrl()).toBe("https://learn.staging.concord.org");
    });

    it("honors a full URL in the portal param", () => {
      history.replaceState(null, "", "/seismic-admin/?portal=https://learn.staging.concord.org");
      expect(getPortalUrl()).toBe("https://learn.staging.concord.org");
    });

    it("strips trailing slashes from the portal param", () => {
      history.replaceState(null, "", "/seismic-admin/?portal=https://learn.staging.concord.org/");
      expect(getPortalUrl()).toBe("https://learn.staging.concord.org");
    });
  });

  describe("getTokenServiceEnv", () => {
    it("defaults to production", () => {
      expect(getTokenServiceEnv()).toBe("production");
    });

    it("returns staging when the tokenServiceEnv param asks for it", () => {
      history.replaceState(null, "", "/seismic-admin/?tokenServiceEnv=staging");
      expect(getTokenServiceEnv()).toBe("staging");
    });

    it("treats any other param value as production", () => {
      history.replaceState(null, "", "/seismic-admin/?tokenServiceEnv=dev");
      expect(getTokenServiceEnv()).toBe("production");
    });
  });

  describe("buildAuthorizeUrl", () => {
    it("includes the response type, client id, and encoded redirect uri", () => {
      history.replaceState(null, "", "/seismic-admin/?x=1#some-hash");
      const url = buildAuthorizeUrl();
      expect(url).toContain("https://learn.concord.org/auth/oauth_authorize");
      expect(url).toContain("response_type=token");
      expect(url).toContain("client_id=seismic-admin");
      // Redirect is origin + pathname + search with the hash excluded.
      const expectedRedirect = encodeURIComponent(`${window.location.origin}/seismic-admin/?x=1`);
      expect(url).toContain(`redirect_uri=${expectedRedirect}`);
    });
  });

  describe("consumeAccessTokenFromLocation", () => {
    it("returns the token from the hash, records the login, and clears the hash", () => {
      history.replaceState(null, "", "/seismic-admin/?x=1#access_token=abc&token_type=bearer");
      const before = Date.now();
      expect(consumeAccessTokenFromLocation()).toBe("abc");
      const record = JSON.parse(localStorage.getItem(LAST_LOGIN_KEY)!);
      expect(record.portal).toBe("https://learn.concord.org");
      expect(record.time).toBeGreaterThanOrEqual(before);
      expect(record.time).toBeLessThanOrEqual(Date.now());
      expect(window.location.hash).toBe("");
      expect(window.location.pathname + window.location.search).toBe("/seismic-admin/?x=1");
    });

    it("never stores the token itself", () => {
      history.replaceState(null, "", "/seismic-admin/#access_token=abc");
      consumeAccessTokenFromLocation();
      expect(JSON.stringify(localStorage)).not.toContain("abc");
      expect(sessionStorage.length).toBe(0);
    });

    it("returns null when there is no OAuth hash", () => {
      expect(consumeAccessTokenFromLocation()).toBeNull();
      expect(localStorage.getItem(LAST_LOGIN_KEY)).toBeNull();
    });

    it("clears the last-login record and the hash when the redirect returns an OAuth error", () => {
      saveRecord("https://learn.concord.org", Date.now());
      history.replaceState(null, "", "/seismic-admin/?x=1#error=access_denied");
      expect(consumeAccessTokenFromLocation()).toBeNull();
      expect(localStorage.getItem(LAST_LOGIN_KEY)).toBeNull();
      expect(window.location.hash).toBe("");
    });

    it("still returns the hash token when storage is unavailable", () => {
      history.replaceState(null, "", "/seismic-admin/#access_token=abc");
      jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
      try {
        expect(consumeAccessTokenFromLocation()).toBe("abc");
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe("shouldAutoLogin", () => {
    it("is true for a fresh record from the current portal", () => {
      saveRecord("https://learn.concord.org", Date.now());
      expect(shouldAutoLogin()).toBe(true);
    });

    it("is true just inside the window and false just past it", () => {
      saveRecord("https://learn.concord.org", Date.now() - AUTO_LOGIN_MAX_AGE_MS + 60_000);
      expect(shouldAutoLogin()).toBe(true);
      saveRecord("https://learn.concord.org", Date.now() - AUTO_LOGIN_MAX_AGE_MS - 1);
      expect(shouldAutoLogin()).toBe(false);
    });

    it("is false for a record from a different portal", () => {
      saveRecord("https://learn.concord.org", Date.now());
      history.replaceState(null, "", "/seismic-admin/?portal=learn.staging.concord.org");
      expect(shouldAutoLogin()).toBe(false);
    });

    it("is false with no record, a malformed record, or unavailable storage", () => {
      expect(shouldAutoLogin()).toBe(false);
      localStorage.setItem(LAST_LOGIN_KEY, "{not json");
      expect(shouldAutoLogin()).toBe(false);
      saveRecord("https://learn.concord.org", Date.now());
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled"); });
      try {
        expect(shouldAutoLogin()).toBe(false);
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe("attemptAutoLogin", () => {
    it("navigates to the authorize URL and returns true when the record is fresh", () => {
      saveRecord("https://learn.concord.org", Date.now());
      const navigate = jest.fn();
      expect(attemptAutoLogin(navigate)).toBe(true);
      expect(navigate).toHaveBeenCalledWith(buildAuthorizeUrl());
    });

    it("does not navigate and returns false without a fresh record", () => {
      const navigate = jest.fn();
      expect(attemptAutoLogin(navigate)).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe("clearLastLogin", () => {
    it("removes the record", () => {
      saveRecord("https://learn.concord.org", Date.now());
      clearLastLogin();
      expect(localStorage.getItem(LAST_LOGIN_KEY)).toBeNull();
    });
  });

  describe("fetchTokenServiceJwt", () => {
    afterEach(() => {
      delete (global as any).fetch;
    });

    it("requests the token-service JWT with bearer auth and returns the token", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "firebase-jwt" }),
      });
      (global as any).fetch = mockFetch;
      await expect(fetchTokenServiceJwt("abc")).resolves.toBe("firebase-jwt");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://learn.concord.org/api/v1/jwt/firebase?firebase_app=token-service",
        { headers: { Authorization: "Bearer abc" } }
      );
    });

    it("throws with the status on a non-OK response", async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
      await expect(fetchTokenServiceJwt("abc")).rejects.toThrow("403");
    });
  });
});
