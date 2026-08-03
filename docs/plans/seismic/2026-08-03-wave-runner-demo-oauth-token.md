# Wave Runner Demo-Space OAuth Bearer Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the Wave Runner's envelope upload flow work from a demo-space URL with an `authDomain` parameter, by falling back to the OAuth access token when the session has no portal JWT.

**Architecture:** `makeTokenServiceJwtGetter` in `src/lib/token-service-jwt.ts` gains a second tier: when the portal store has no `rawPortalJWT`/`basePortalUrl` (demo/qa mode) but does have a `bearerToken` (from the `authDomain` OAuth round-trip) and `urlParams.authDomain`, it exchanges the bearer token directly for a portal-signed firebase JWT for the `token-service` app — the same `"Bearer"`-type exchange the seismic-admin uses. No retry tier for the fallback: an expired access token has nothing to refresh it with. Design doc: `docs/plans/seismic/2026-08-03-wave-runner-demo-oauth-token-design.md`.

**Tech Stack:** TypeScript, Jest (run with `--no-watchman` on this machine). No new dependencies.

---

### Task 1: Bearer-token fallback tier in makeTokenServiceJwtGetter

**Files:**
- Modify: `src/lib/token-service-jwt.ts`
- Test: `src/lib/token-service-jwt.test.ts`

**Step 1: Write the failing tests**

In `src/lib/token-service-jwt.test.ts`, first extend the `specPortal` helper so the fallback fields have explicit defaults (the real `Portal` always has `urlParams`; without this default the new code path would read `authDomain` off `undefined` in older tests):

```ts
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
```

Then add a nested describe after the existing tests (inside `describe("makeTokenServiceJwtGetter", ...)`):

```ts
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
        "https://learn.example.com/", "Bearer", "access-token", undefined, TOKEN_SERVICE_FIREBASE_APP);
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
        "https://learn.example.com/", "Bearer/JWT", "portal-jwt", undefined, TOKEN_SERVICE_FIREBASE_APP);
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
```

**Step 2: Run the tests to verify the new ones fail**

Run: `npm test -- --no-watchman src/lib/token-service-jwt.test.ts`

Expected: the 4 existing tests PASS; the 4 new tests FAIL (`getJwt` is `undefined` for the fallback cases, and the missing-token case passes only by accident — confirm the exchange-shaped tests fail with "TypeError: getJwt is not a function" or similar).

**Step 3: Implement the fallback tier**

Replace the body of `makeTokenServiceJwtGetter` in `src/lib/token-service-jwt.ts` (keep `TOKEN_SERVICE_FIREBASE_APP` and imports as-is) with:

```ts
/**
 * Returns a getJwt callback (for createEnvelopeCredentialsProvider) that obtains a
 * portal-signed firebase JWT for the token-service app, or undefined when the session
 * has no way to get one.
 *
 * Portal-authenticated sessions exchange the session's portal JWT. The portal JWT
 * expires ~1h after launch, so a failed exchange refreshes it via the stored bearer
 * credentials and retries once.
 *
 * Demo/qa sessions launched with an authDomain parameter have no portal JWT, but the
 * OAuth round-trip leaves an access token on the portal store; that bearer token is
 * exchanged directly (as the seismic-admin does). There is no refresh path for an
 * expired access token, so the exchange is not retried — reloading the page re-runs
 * the OAuth flow.
 */
export function makeTokenServiceJwtGetter(portal: Portal): (() => Promise<string>) | undefined {
  const { basePortalUrl, bearerToken } = portal;

  if (portal.rawPortalJWT && basePortalUrl) {
    // Reads rawPortalJWT at call time so the retry below picks up the refreshed value.
    const exchange = async () => {
      const [rawJwt] = await getFirebaseJWTWithBearerToken(
        basePortalUrl, "Bearer/JWT", portal.rawPortalJWT, undefined, TOKEN_SERVICE_FIREBASE_APP);
      return rawJwt;
    };
    return async () => {
      try {
        return await exchange();
      } catch (error) {
        console.warn("Token-service JWT exchange failed; refreshing the portal JWT:", error);
        await portal.requestPortalJWT();
        return exchange();
      }
    };
  }

  const authDomain = portal.urlParams?.authDomain;
  if (bearerToken && authDomain) {
    const base = authDomain.endsWith("/") ? authDomain : `${authDomain}/`;
    return async () => {
      const [rawJwt] = await getFirebaseJWTWithBearerToken(
        base, "Bearer", bearerToken, undefined, TOKEN_SERVICE_FIREBASE_APP);
      return rawJwt;
    };
  }

  return undefined;
}
```

Note the guard change: the old code early-returned on `!portal.rawPortalJWT || !basePortalUrl`; the new structure makes each tier's condition positive so the fallback is reachable.

**Step 4: Run the tests to verify all pass**

Run: `npm test -- --no-watchman src/lib/token-service-jwt.test.ts`

Expected: all 8 tests PASS.

**Step 5: Lint and type-check**

Run: `npx eslint src/lib/token-service-jwt.ts src/lib/token-service-jwt.test.ts`
Expected: no errors.

Run: `npm run check:types`
Expected: no errors.

**Step 6: Commit**

```bash
git add src/lib/token-service-jwt.ts src/lib/token-service-jwt.test.ts
git commit -m "Fall back to the OAuth bearer token for token-service JWTs in demo mode

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Manual verification against the staging portal

No code. Verify end-to-end:

1. `npm start`
2. Open (adjusting unit/problem to one with a Wave Runner tile):
   `http://localhost:8080/?appMode=demo&fakeClass=1&fakeUser=teacher:1&unit=<unit>&authDomain=https://learn.portal.staging.concord.org&tokenServiceEnv=staging`
3. Log in at the staging portal when redirected; confirm you land back in the demo space.
4. In a Wave Runner tile, pick a station and confirm **Load Data** is enabled; click it and confirm envelope loading/upload proceeds (status section shows progress, no auth errors in the console).

Prerequisites (outside this repo): the staging portal's `clue` OAuth client must list `http://localhost:8080/` as a redirect URI (it does, per the comment in `src/utilities/auth-utils.ts`), and the staging token-service must have the `v2` envelope resource with the `authenticated` access rule.
