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
      "https://learn.example.com/", "Bearer/JWT", "portal-jwt", undefined, TOKEN_SERVICE_FIREBASE_APP);
  });

  it("refreshes the portal JWT and retries once when the exchange fails", async () => {
    const portal = specPortal();
    mockExchange
      .mockRejectedValueOnce(new Error("401"))
      .mockImplementationOnce(async (_base, _type, jwt) => [`ts-jwt-for-${jwt}`, {}]);
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
});
