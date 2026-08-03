# Wave Runner envelope uploads from demo-space URLs (OAuth bearer fallback)

## Problem

Testing the Wave Runner envelope upload flow currently requires a real portal launch
(assignment + external report), which is slow and error prone. A demo-space URL with an
`authDomain` parameter already runs the OAuth flow — `initializeAuthorization()` redirects to
the portal and comes back with an access token that lands on the `Portal` store as
`bearerToken` — but in demo/qa mode `authenticate()` returns fake auth early and never calls
`portalService.initialize()`, so `portal.rawPortalJWT` and `portal.basePortalUrl` stay unset.
`makeTokenServiceJwtGetter` requires both, returns `undefined`, and the Load Data button stays
disabled.

## Decision

Add a bearer-token fallback tier to `makeTokenServiceJwtGetter` (approach B). Core auth
(`auth.ts`, `portal.ts`) is untouched; the change is confined to `src/lib/token-service-jwt.ts`
and its test.

The alternative considered (approach A: hydrate `basePortalUrl`/`rawPortalJWT` on the portal
store from inside `authenticate()`'s demo branch) keeps the refresh-and-retry path but touches
core auth for a testing affordance; B was chosen to keep the change confined to the
token-service path.

## Behavior

`makeTokenServiceJwtGetter(portal)` gains a second tier, tried only when the first doesn't
apply:

1. **Portal-authed session** (unchanged): `rawPortalJWT && basePortalUrl` → `Bearer/JWT`
   exchange with refresh-and-retry, exactly as today.
2. **OAuth bearer fallback** (new): no `rawPortalJWT`, but `portal.bearerToken` is set and
   `portal.urlParams.authDomain` is present → return a getter that calls
   `getFirebaseJWTWithBearerToken(ensureTrailingSlash(authDomain), "Bearer",
   portal.bearerToken, undefined, TOKEN_SERVICE_FIREBASE_APP)` — the same exchange the
   seismic-admin uses (`src/seismic-admin/utils/portal-auth.ts`). No retry tier: an expired
   access token has nothing to refresh it with; the error surfaces in the tile's existing
   status/error display, and a page reload re-runs OAuth (silently when the portal session is
   still alive).
3. **Neither** → `undefined`; Load Data stays disabled (today's behavior for plain
   demo/dev URLs).

Guard on `portal.urlParams.authDomain` directly rather than calling `getBasePortalUrl()`,
which throws when no domain param exists and drags in report-launch logic.

## Testing usage

```
http://localhost:8080/?appMode=demo&fakeClass=1&fakeUser=teacher:1&unit=...
  &authDomain=https://learn.portal.staging.concord.org&tokenServiceEnv=staging
```

Log in once at the portal, land back in the demo space, Load Data enables. Uploads run as the
real portal account (token-service's `authenticated` access rule accepts any valid portal
JWT). The portal's `clue` OAuth client must list the test origin as a redirect URI
(localhost:8080 already is).

## Tests

Extend `src/lib/token-service-jwt.test.ts`:

- fallback getter returned when `bearerToken` + `authDomain` are present without a portal JWT;
- exchange called with `"Bearer"` type and the token-service firebase app;
- still `undefined` when neither tier applies;
- portal-JWT tier still wins when both are available.
