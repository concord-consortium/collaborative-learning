import { getFirebaseJWTWithBearerToken } from "./auth";
import { makeTokenServiceJwtGetter, TOKEN_SERVICE_FIREBASE_APP } from "./token-service-jwt";
import { Portal } from "../models/stores/portal";

jest.mock("./auth", () => ({
  getFirebaseJWTWithBearerToken: jest.fn(),
}));
const mockExchange = getFirebaseJWTWithBearerToken as jest.Mock;

function specPortal(overrides?: Record<string, unknown>) {
  return {
    rawPortalJWT: "portal-jwt",
    basePortalUrl: "https://learn.example.com/",
    bearerToken: undefined,
    urlParams: {},
    requestPortalJWT: jest.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as Portal;
}

describe("makeTokenServiceJwtGetter", () => {
  beforeEach(() => mockExchange.mockReset());

  it("returns undefined when the session has no portal JWT", () => {
    expect(makeTokenServiceJwtGetter(specPortal({ rawPortalJWT: undefined }))).toBeUndefined();
    expect(makeTokenServiceJwtGetter(specPortal({ basePortalUrl: undefined }))).toBeUndefined();
  });

  it("exchanges the portal JWT for a token-service firebase JWT", async () => {
    mockExchange.mockResolvedValue(["ts-jwt", {}]);
    const getJwt = makeTokenServiceJwtGetter(specPortal())!;
    await expect(getJwt()).resolves.toBe("ts-jwt");
    expect(mockExchange).toHaveBeenCalledWith(
      "https://learn.example.com/", "portal-jwt", undefined, TOKEN_SERVICE_FIREBASE_APP);
  });

  it("refreshes the portal JWT and retries once when the exchange fails", async () => {
    const portal = specPortal();
    mockExchange
      .mockRejectedValueOnce(new Error("401"))
      .mockImplementationOnce(async (_base, jwt) => [`ts-jwt-for-${jwt}`, {}]);
    (portal.requestPortalJWT as jest.Mock).mockImplementation(async () => {
      (portal as { rawPortalJWT: string }).rawPortalJWT = "fresh-portal-jwt";
      return {};
    });
    const getJwt = makeTokenServiceJwtGetter(portal)!;
    await expect(getJwt()).resolves.toBe("ts-jwt-for-fresh-portal-jwt");
    expect(portal.requestPortalJWT).toHaveBeenCalled();
  });

  it("rejects when the retry also fails", async () => {
    const portal = specPortal();
    mockExchange.mockRejectedValue(new Error("still 401"));
    const getJwt = makeTokenServiceJwtGetter(portal)!;
    await expect(getJwt()).rejects.toThrow("still 401");
    expect(portal.requestPortalJWT).toHaveBeenCalledTimes(1);
  });

  describe("bearer-token fallback (authDomain demo-space launches)", () => {
    const fallbackPortal = (overrides?: Record<string, unknown>) => specPortal({
      rawPortalJWT: undefined,
      basePortalUrl: undefined,
      bearerToken: "access-token",
      urlParams: { authDomain: "https://learn.example.com" },
      ...overrides,
    });

    it("exchanges the OAuth bearer token when there is no portal JWT", async () => {
      mockExchange.mockResolvedValue(["ts-jwt", {}]);
      const getJwt = makeTokenServiceJwtGetter(fallbackPortal())!;
      await expect(getJwt()).resolves.toBe("ts-jwt");
      expect(mockExchange).toHaveBeenCalledWith(
        "https://learn.example.com/", "access-token", undefined, TOKEN_SERVICE_FIREBASE_APP);
    });

    it("returns undefined when the bearer token or authDomain is missing", () => {
      expect(makeTokenServiceJwtGetter(fallbackPortal({ bearerToken: undefined }))).toBeUndefined();
      expect(makeTokenServiceJwtGetter(fallbackPortal({ urlParams: {} }))).toBeUndefined();
    });

    it("prefers the portal JWT tier when both are available", async () => {
      mockExchange.mockResolvedValue(["ts-jwt", {}]);
      const portal = fallbackPortal({
        rawPortalJWT: "portal-jwt",
        basePortalUrl: "https://learn.example.com/",
      });
      const getJwt = makeTokenServiceJwtGetter(portal)!;
      await getJwt();
      expect(mockExchange).toHaveBeenCalledWith(
        "https://learn.example.com/", "portal-jwt", undefined, TOKEN_SERVICE_FIREBASE_APP);
    });

    it("does not refresh or retry when the bearer exchange fails", async () => {
      const portal = fallbackPortal();
      mockExchange.mockRejectedValue(new Error("401"));
      const getJwt = makeTokenServiceJwtGetter(portal)!;
      await expect(getJwt()).rejects.toThrow("401");
      expect(portal.requestPortalJWT).not.toHaveBeenCalled();
      expect(mockExchange).toHaveBeenCalledTimes(1);
    });
  });
});
