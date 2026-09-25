# Planned Firestore rules tightening

**Status:** planned, not yet started. Tracked internally as CLUE-612. Delete this doc when the tightening
lands; the rules comments it replaces go with it.

Two Firestore rules for axes-typed documents (group and class-wide documents) still admit a value or a write
that exists only for older data and older clients. Both can be narrowed once nothing depends on them. This
change touches only `firestore.rules` and its tests; no app code changes with it.

## What changes

1. **`concurrent` becomes settable only at creation.** Delete `concurrentChangeOk` and add `concurrent` to the
   read-only fields in `preservesReadOnlyDocumentFields`. Today any class member may set `concurrent: true`
   on an axes-typed document after creation, because older app bundles backfill the field as the signed-in
   user (see "Why it waits"). Creation is already constrained: `concurrentCreateOk` requires a synthetic
   owner for a concurrent document, and `documentOwnerOk` pins the owner, so a class member cannot create a
   document under a classmate's `uid` with `concurrent: true`. Nothing needs to change at creation.

   This also closes a residual described in the comment on `concurrentChangeOk`: a class member can create
   an axes-typed document they own with no `concurrent` field, and a classmate can then set it to `true`,
   granting the whole class access to that document's history.

2. **The canonical-race delete stops accepting `type: "group"`.** Class members may delete the losing
   (non-canonical) documents of a canonical-pointer creation race. The clause accepts both `"group"` and
   `"axes"` because pre-sweep documents stored `"group"`. The axes sweep has rewritten them, so once no
   older bundle can still be racing on one, `"axes"` alone is enough.

The tests follow the rules: the cases that set `concurrent` on an existing group-typed document flip from
succeeding to failing, and the tests that exercise the `"group"` value of the race delete are removed. The
`"axes"` cases already cover what remains.

## Why it waits

A rules change that *narrows* what is allowed must ship after every client that still makes the write is
gone. Rules apply to all clients at once, while an old bundle can stay open in a browser long after a new
release is deployed.

Here the write is the open-time `concurrent` backfill, which older app bundles run on group documents opened
without the field. The current app does not make it, and the axes sweep
(`scripts/backfill-group-document-axes.ts`) has stamped `concurrent` and rewritten `type` on existing
documents. So the tightening can ship once the older bundles have drained from users' browsers, provided the
sweep's dry run still reports no group-typed documents in any environment.
