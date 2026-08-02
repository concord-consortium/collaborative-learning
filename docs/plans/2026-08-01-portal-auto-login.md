# Portal Auto Re-Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** The seismic admin page stops persisting the portal OAuth access token; it records only `{portal, time}` of the last successful login and silently re-runs the OAuth redirect on load while that record is under 8 hours old.

**Architecture:** All logic lives in `src/seismic-admin/utils/portal-auth.ts`: `consumeAccessTokenFromLocation` records the login (localStorage) instead of the token (sessionStorage) and clears the record on an OAuth error hash; new `shouldAutoLogin`/`attemptAutoLogin` decide and perform the redirect (with an injectable `navigate` seam for tests). `app.tsx` consumes the hash first and bails into the redirect before the catalog/store spin up. Design: `docs/plans/2026-08-01-portal-auto-login-design.md`.

**Tech Stack:** TypeScript, React 17, Jest (jsdom). Run Jest with `--no-watchman` always.

**Verification commands:**
- `npm test -- --no-watchman src/seismic-admin/utils/portal-auth.test.ts`
- `npm run check:types`
- `npm run lint:build` (before finishing)

**Key background:**
- Current flow: login button → portal OAuth implicit flow → `#access_token=` hash → `consumeAccessTokenFromLocation()` saves `{portal, token}` to sessionStorage and returns the token; reloads read it back. `makeTokenServiceJwtGetter` clears the stored token when the JWT exchange fails.
- The token is ~1h-lived; the portal session usually outlives it, so a redirect through `buildAuthorizeUrl()` with a live portal session lands straight back with a fresh token in the hash.
- jsdom cannot intercept real navigation; `attemptAutoLogin` therefore takes an injectable `navigate` callback defaulting to `window.location.assign`.
- `makeTokenServiceJwtGetter` loses its only job (clearing the stored token) and is deleted; `app.tsx` inlines `() => fetchTokenServiceJwt(accessToken)`.

---

### Task 1: Rework portal-auth persistence

**Files:**
- Modify: `src/seismic-admin/utils/portal-auth.ts`
- Test: `src/seismic-admin/utils/portal-auth.test.ts`

**Step 1: Rewrite the tests to the new contract**

In `portal-auth.test.ts`:

a. Update the import line: drop `clearAccessToken` and `makeTokenServiceJwtGetter`; add `attemptAutoLogin`, `clearLastLogin`, `shouldAutoLogin`, `AUTO_LOGIN_MAX_AGE_MS`.

b. Replace the module-level key constant:

```ts
const LAST_LOGIN_KEY = "seismic-admin-portal-last-login";
```

c. In the top-level `beforeEach`, replace `sessionStorage.clear();` with `localStorage.clear();`.

d. Add a helper near the top of the describe (after `beforeEach`):

```ts
  const saveRecord = (portal: string, time: number) =>
    localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ portal, time }));
```

e. Replace the whole `consumeAccessTokenFromLocation` describe with:

```ts
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
```

f. Replace the `clearAccessToken` describe with:

```ts
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
```

g. Delete the whole `makeTokenServiceJwtGetter` describe (the function is going away; `fetchTokenServiceJwt` tests already cover the exchange).

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/seismic-admin/utils/portal-auth.test.ts`
Expected: FAIL — the new functions don't exist yet (ts-jest may surface this as runtime `undefined` calls rather than compile errors).

**Step 3: Implement in `portal-auth.ts`**

Replace the `ACCESS_TOKEN_KEY` constant with:

```ts
const LAST_LOGIN_KEY = "seismic-admin-portal-last-login";
/** Auto-login window: a login this recent means the portal session is probably
 *  still alive, so a silent redirect will land back with a fresh token. */
export const AUTO_LOGIN_MAX_AGE_MS = 8 * 60 * 60 * 1000;
```

Replace `consumeAccessTokenFromLocation` and `clearAccessToken` with:

```ts
/**
 * Access token from the OAuth redirect hash; null when this page load isn't an
 * OAuth return. The token is held in memory only — never persisted — but the
 * successful login is recorded (portal + time) so a later load can silently
 * re-run the redirect while the portal session is likely still alive. An OAuth
 * error in the hash clears that record so a failed attempt can't loop.
 */
export function consumeAccessTokenFromLocation(): string | null {
  const match = /access_token=([^&]+)/.exec(window.location.hash);
  if (match) {
    saveLastLogin();
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return match[1];
  }
  if (/(^#|[#&])error=/.test(window.location.hash)) {
    clearLastLogin();
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  return null;
}

function saveLastLogin() {
  try {
    localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ portal: getPortalUrl(), time: Date.now() }));
  } catch {
    // Persistence is a convenience; a failure here must not break login.
  }
}

export function clearLastLogin() {
  try {
    localStorage.removeItem(LAST_LOGIN_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}

/** True when the last successful login was against the current portal within the window. */
export function shouldAutoLogin(): boolean {
  try {
    const raw = localStorage.getItem(LAST_LOGIN_KEY);
    if (!raw) return false;
    const { portal, time } = JSON.parse(raw) ?? {};
    return portal === getPortalUrl() && typeof time === "number" &&
      Date.now() - time < AUTO_LOGIN_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** Silently re-run the OAuth redirect when the last login is fresh enough.
 *  Returns true when navigation was started (the page is about to unload).
 *  `navigate` is a test seam; production uses a real location change. */
export function attemptAutoLogin(navigate: (url: string) => void = url => window.location.assign(url)): boolean {
  if (!shouldAutoLogin()) return false;
  navigate(buildAuthorizeUrl());
  return true;
}
```

Delete `makeTokenServiceJwtGetter` entirely (its only extra behavior was clearing the stored token; the last-login record deliberately survives a failed exchange so the next reload auto-attempts a fresh login). `fetchTokenServiceJwt` is unchanged. Note `app.tsx` still imports the deleted function — that compile error is fixed in Task 2; run only the portal-auth test file in this task.

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/seismic-admin/utils/portal-auth.test.ts`
Expected: all PASS.

**Step 5: Commit**

```bash
git add src/seismic-admin/utils/portal-auth.ts src/seismic-admin/utils/portal-auth.test.ts
git commit -m "Record last portal login instead of storing the access token."
```

---

### Task 2: Wire auto-login into app.tsx

**Files:**
- Modify: `src/seismic-admin/components/app.tsx`
- Create: `src/seismic-admin/components/app.test.tsx`

**Step 1: Write the failing tests**

Create `app.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import React from "react";
import * as portalAuth from "../utils/portal-auth";
import { App } from "./app";

jest.mock("../utils/admin-firebase", () => ({
  initAdminFirebase: jest.fn(async () => undefined),
}));
jest.mock("../utils/load-catalog", () => ({
  loadCatalog: jest.fn(async () => ({ stations: [], models: [] })),
}));
// The store constructor touches OPFS via its default cache; give it a quiet fake.
jest.mock("../seismic-admin-store", () => {
  const actual = jest.requireActual("../seismic-admin-store");
  const cache = {
    listStations: async () => [],
    scanCachedDays: async () => new Set<number>(),
    stationRawBytes: async () => 0,
    deleteDaysInRange: async () => {},
  };
  return {
    ...actual,
    SeismicAdminStore: class extends actual.SeismicAdminStore {
      constructor(deps: any = {}) { super({ ...deps, cache }); }
    },
  };
});

const { loadCatalog } = jest.requireMock("../utils/load-catalog");

describe("App auto-login", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/seismic-admin/");
    jest.clearAllMocks();
  });

  it("redirects through the portal before loading the catalog when the last login is fresh", () => {
    localStorage.setItem("seismic-admin-portal-last-login",
      JSON.stringify({ portal: "https://learn.concord.org", time: Date.now() }));
    const attemptSpy = jest.spyOn(portalAuth, "attemptAutoLogin").mockReturnValue(true);

    render(<App />);

    expect(attemptSpy).toHaveBeenCalled();
    expect(loadCatalog).not.toHaveBeenCalled();
    // The page shows the loading state while the browser navigates away.
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("proceeds without redirecting when there is no fresh login record", async () => {
    render(<App />);
    expect(loadCatalog).toHaveBeenCalled();
    // The header renders once the store exists; no portal auth is set up.
    expect(await screen.findByText(/Seismic/i)).toBeInTheDocument();
  });
});
```

Adjust the final assertion to whatever stable text `AdminHeader` actually renders (check `admin-header.tsx`; a heading like "Seismic Data Admin" — use its real text). If mocking the store class proves awkward, an alternative seam is `jest.spyOn(SeismicAdminStore.prototype, "refresh").mockResolvedValue(undefined)` plus constructing with the real class — implementer's choice, but the test MUST NOT touch real OPFS/Firebase.

**Step 2: Run tests to verify they fail**

Run: `npm test -- --no-watchman src/seismic-admin/components/app.test.tsx`
Expected: FAIL — `attemptAutoLogin` is never called by the current `app.tsx` (first test), and `app.tsx` doesn't compile against the deleted `makeTokenServiceJwtGetter` import.

**Step 3: Implement in `app.tsx`**

- Update the portal-auth import to `{ attemptAutoLogin, consumeAccessTokenFromLocation, fetchTokenServiceJwt, getTokenServiceEnv }`.
- At the top of the `useEffect`, before `initAdminFirebase`/`loadCatalog` are touched:

```ts
    // An OAuth return supplies a token in the hash. Otherwise, a fresh prior login
    // means the portal session is probably alive: bounce through the portal before
    // spinning anything up and come straight back with a token.
    const accessToken = consumeAccessTokenFromLocation();
    if (!accessToken && attemptAutoLogin()) return;
```

- In the `loadCatalog().then` block, replace the old token consumption and its stale comment with:

```ts
      // JWTs are fetched per credentials refresh from the in-memory token. A failed
      // fetch surfaces through the update-flow errors; the last-login record survives,
      // so the next reload silently re-authenticates instead of showing the button.
      if (accessToken) {
        created.setPortalAuth(() => fetchTokenServiceJwt(accessToken), getTokenServiceEnv());
      }
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --no-watchman src/seismic-admin/components/app.test.tsx src/seismic-admin/utils/portal-auth.test.ts`
Expected: all PASS.

Run: `npm run check:types`
Expected: clean (no lingering `makeTokenServiceJwtGetter` references).

**Step 5: Commit**

```bash
git add src/seismic-admin/components/app.tsx src/seismic-admin/components/app.test.tsx
git commit -m "Auto re-login to the portal while the last login is fresh."
```

---

### Task 3: Full verification

**Step 1: Run the admin + seismic suites**

Run: `npm test -- --no-watchman src/seismic-admin src/models/stores/seismic shared/seismic`
Expected: all PASS.

**Step 2: Full suite, lint, types**

Run: `npm test -- --no-watchman`
Expected: all PASS.

Run: `npm run lint:build && npm run check:types`
Expected: clean (pre-existing cypress warnings in `xy_plot_tool_spec.js` are not ours).

**Step 3: Commit any stragglers and stop**

Then follow superpowers:finishing-a-development-branch (and suggest a manual browser check: load the admin, log in, reload within 8h → lands back logged in without clicking; `?portal=` mismatch and >8h show the button).
