# Seismic admin: auto re-login instead of storing the portal token

## Problem

The seismic admin page stores the portal OAuth access token in sessionStorage so
reloads keep working. Tokens in web storage are exfiltratable and the stored
token goes stale within ~1 hour anyway. Instead of persisting the token, persist
only when and where the user last logged in, and silently re-run the OAuth
redirect on load while that record is fresh.

## Background

Current flow (src/seismic-admin/utils/portal-auth.ts, components/app.tsx):
login button → portal OAuth implicit flow → `#access_token=` hash →
`consumeAccessTokenFromLocation()` saves `{portal, token}` to sessionStorage and
returns the token; reloads read it back (same-portal only). A failed JWT
exchange clears the stored token so the next reload shows the login button.

## Design

### Persistence

The access token is never written to storage — it lives only in memory for the
page's lifetime. localStorage (so auto-login survives tab close/restart) keeps
one record under `seismic-admin-portal-last-login`:

```json
{ "portal": "https://learn.concord.org", "time": 1785340800000 }
```

Written (or refreshed) every time a token is successfully consumed from the
OAuth redirect hash — each successful round-trip is a confirmed login, so the
8-hour window slides with use.

### Load flow

1. `consumeAccessTokenFromLocation()` (simplified): token in hash → save
   `{portal, time}`, strip the hash, return the token. No sessionStorage
   involvement.
2. No token: a new `shouldAutoLogin()` returns true when the stored record's
   portal matches `getPortalUrl()` and it is less than 8 hours old
   (`Date.now()`). If true, app.tsx immediately sets
   `window.location.href = buildAuthorizeUrl()` — before the catalog/store spin
   up, so the bounce is cheap. With a live portal session the user lands right
   back with a fresh token.
3. Record stale, for a different portal, or absent → today's behavior: the
   login button.

### Failure handling (no redirect loops)

- An OAuth error in the redirect hash (e.g. `#error=access_denied`) clears the
  stored record and shows the login button — no further auto-attempts until a
  successful manual login. One redirect max per page load by construction.
- Dead portal session: the portal shows its own login page — acceptable within
  the 8h window; logging in there returns to the admin normally.
- Mid-session stale token (JWT exchange fails): keep the stored record so the
  *next reload* auto-attempts and silently fixes the common case (expired ~1h
  token, live portal session). `clearAccessToken` goes away; `clearLastLogin`
  exists for the error-hash case.

### Removed

`ACCESS_TOKEN_KEY` sessionStorage read/write/remove, and app.tsx's comment
about the ~1h token in sessionStorage.

## Implementation addenda

Two changes made during implementation, superseding details above:

- The silent redirect uses `window.location.replace` (not `assign`) so Back from
  the round-trip doesn't land on a page that immediately re-redirects.
- `buildAuthorizeUrl` canonicalizes the redirect path (strips `index.html`,
  ensures a trailing slash): the portal 500s on any redirect_uri that doesn't
  exactly match the client's registered URIs, which end in `/`.

## Testing

- portal-auth.test.ts: hash consumption saves `{portal, time}` (not the token);
  `shouldAutoLogin` true/false around the 8h boundary and on portal mismatch;
  error-hash clears the record; JWT-getter failure no longer touches storage.
- app.tsx auto-redirect: cover via the existing `buildAuthorizeUrl` spy pattern
  (see admin-header.test.tsx) plus a location seam.
