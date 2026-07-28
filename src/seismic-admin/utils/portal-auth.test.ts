import {
  buildAuthorizeUrl, clearAccessToken, consumeAccessTokenFromLocation, fetchPortalFirebaseJwt, getPortalUrl,
  getTokenServiceEnv
} from "./portal-auth";

const ACCESS_TOKEN_KEY = "seismic-admin-portal-access-token";

describe("portal-auth", () => {
  beforeEach(() => {
    sessionStorage.clear();
    history.replaceState(null, "", "/seismic-admin/");
  });

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
    it("returns the token from the hash, stores it with its portal, and clears the hash", () => {
      history.replaceState(null, "", "/seismic-admin/?x=1#access_token=abc&token_type=bearer");
      expect(consumeAccessTokenFromLocation()).toBe("abc");
      expect(JSON.parse(sessionStorage.getItem(ACCESS_TOKEN_KEY)!))
        .toEqual({ portal: "https://learn.concord.org", token: "abc" });
      expect(window.location.hash).toBe("");
      expect(window.location.pathname + window.location.search).toBe("/seismic-admin/?x=1");
    });

    it("returns the stored token when there is no hash and the portal matches", () => {
      sessionStorage.setItem(ACCESS_TOKEN_KEY,
        JSON.stringify({ portal: "https://learn.concord.org", token: "stored-token" }));
      expect(consumeAccessTokenFromLocation()).toBe("stored-token");
    });

    it("does not return a token issued by a different portal, and removes it", () => {
      sessionStorage.setItem(ACCESS_TOKEN_KEY,
        JSON.stringify({ portal: "https://learn.concord.org", token: "stored-token" }));
      history.replaceState(null, "", "/seismic-admin/?portal=learn.staging.concord.org");
      expect(consumeAccessTokenFromLocation()).toBeNull();
      expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    });

    it("returns null on a malformed stored record", () => {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, "{not json");
      expect(consumeAccessTokenFromLocation()).toBeNull();
    });

    it("returns null with no hash and no stored token", () => {
      expect(consumeAccessTokenFromLocation()).toBeNull();
    });

    it("returns null when sessionStorage is unavailable", () => {
      jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("disabled"); });
      try {
        expect(consumeAccessTokenFromLocation()).toBeNull();
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe("clearAccessToken", () => {
    it("removes the stored token", () => {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, "abc");
      clearAccessToken();
      expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    });
  });

  describe("fetchPortalFirebaseJwt", () => {
    afterEach(() => {
      delete (global as any).fetch;
    });

    it("requests the token-service JWT with bearer auth and returns the token", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ token: "firebase-jwt" }),
      });
      (global as any).fetch = mockFetch;
      await expect(fetchPortalFirebaseJwt("abc")).resolves.toBe("firebase-jwt");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://learn.concord.org/api/v1/jwt/firebase?firebase_app=token-service",
        { headers: { Authorization: "Bearer abc" } }
      );
    });

    it("throws with the status on a non-OK response", async () => {
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
      await expect(fetchPortalFirebaseJwt("abc")).rejects.toThrow("403");
    });
  });
});
