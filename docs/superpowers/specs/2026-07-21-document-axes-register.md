# Document Axes: Register

> **Status:** Decision record (not developer-facing reference). This is the analysis that *produced* the
> document-axes docs — why *these* axes and not others, and what is deliberately *not* an axis. For what the
> axes are and how they live in code, read [axes.md](../../document-axes/axes.md) and
> [target-architecture.md](../../document-axes/target-architecture.md); this document is kept as the record of
> the reasoning behind them.

> **Purpose:** we identified axes and candidate axes one at a time while analyzing `type`. This document
> lists them **all together** so we can (a) confirm the set is complete, (b) find axes that overlap or are
> derivable from one another, and (c) see what is *not* an axis. Evidence and per-site detail come from a separate
> current-state analysis of the code; this document is the index and the overlap analysis over that evidence.
>
> **Framing — "ideal world."** This document assumes we can change any code however we want (storage layout,
> security rules, models, migrations). Overlaps are resolved under that assumption; current-code constraints
> and migration cost are **out of scope** here and tracked as *Punted issues* (§G). The *current-state*
> analysis (what the code does today) is a separate effort; this register is the *target* model (what the axes
> should be in the ideal world).

## A. Document-intrinsic axes (the current working set)

These are properties a document *has*, that logic reads at runtime.

| axis | value type | meaning | rough per-type values | status |
|---|---|---|---|---|
| **`kind`** | stored registry key | preset/cohort tag: supplies creation defaults + presentation + copy/publish templates, and is the **migration cohort key**; **not** a runtime branch | problem / planning / personal / learningLog / group / exemplar / support | **resolved (O6)** — stored metadata, not a runtime discriminator |
| **`canonical`** | bool | is this *the* single pointed-to doc for a (scope, kind) slot | group = yes; problem/planning intended = yes; others = no | confirmed |
| **`concurrent`** | bool (stored) | multi-writer (Concurrent history manager) vs single-writer | group = yes; all others = no | **confirmed (O2): stored per-doc axis** — concurrent docs carry special stored metadata state, so the flag marks that association explicitly (and is rule-readable), even though the value is currently constant per kind |
| **`owner`** | uid \| none | owning/authoring **identity** & provenance (attribution, unpublish authority); referenced by `permissions` grants; distinct from `scope`'s user-association (diverges for publications) | student/teacher uid for most; **none** for group; publisher for publications; synthetic for exemplar | **confirmed (O3)** — stays separate |
| **`scope`** (was `location`) | context-assoc refs | the doc's position across **org** `{network?, class?, offering?, group?, user?}` and **curriculum** `{unit?, problem?, section?}` hierarchies; `class` is **optional** (curriculum/exemplar are class-less). Storage-path meaning **removed**; labels ("user-in-offering") are derived | user-in-offering; user-in-class; group-in-offering; offering/class (pubs); curriculum/exemplar (class-less) | **revised — see O4 & §H** (addressing dropped, scope kept & expanded) |
| **`permissions`** | composed grant set | who may perform which **operations** (`read`/`write`/`publish`/`copy`/…), and frozen. **Composed at runtime** from *permission-policy grants* (referenced policy — not stored, no migration) **+** *per-doc grants* (stored — only the parts that vary: the `visibility` share toggle, support audience, exemplar visibility) | owner+teacher (kind default); group (group doc); class (publications); structured target (support); per-student (exemplar) | confirmed — unifies readAudience/writePolicy/frozen/**visibility**; carries scope (via principals) & operations (O5); **hybrid stored+lookup** (§I) |

`permissions` sub-facets (all folded into the one axis): **readAudience**, **writePolicy**, **frozen** (= no
write grant on content).

## B. Candidate properties (behaviors that flipped out of `kind`)

**Both candidates resolved (O7 / §I) — neither becomes a stored per-doc axis; the resolutions are recorded below:**

- **`showInSortWork`** → a `kind`/unit **registry lookup** (constant per kind: {problem, personal,
  learningLog, exemplar, group}); no storage, no migration.
- **Student-Work membership** → a **derivation** (`kind` = problem + `owner` ≠ viewer).

## C. Resolved away — turned out NOT to be new document axes

- **publication-state** → `frozen` + `permissions` (publishing = frozen snapshot with a wider-audience grant; no unpublish). *(was + `location`; location removed — O4.)*
- **offering-association** (`isOfferingType`) → the **`scope`** *offering* association (§H). **Not** `permissions` — there is no offering principal, so this is irreducible scope data.
- **`required` / startup provisioning** → `canonical` (mechanism: ensure-slot vs seed-if-empty) + **unit config** (which kinds).
- **nav My/Class routing** → `frozen` + `owner`.
- **content-monitoring** → `permissions` (one universal "sync what I can see and am not editing" behavior).
- **4-up group canvas** → `canonical` + `owner`(user) + group-`permissions` + **`scope`**(user + offering) **+ non-document context** (viewer-in-a-group, workspace mode). *(The offering context is the `scope` offering association, §H — not derivable from `permissions` alone.)*
- **exemplar visibility** → `permissions` (subject-indexed read grants).
- **`publishable` / `copyable`** → `permissions` (`publish`, `copy`). *Who* may do it is a grant; *whether a doc allows it at all* = whether any such grant exists. The *result* (what the new doc looks like) is a preset **template** (registry — O6), not permissions.
- **`visibility`** (public/private share toggle) → `permissions` — a per-doc, user-toggleable **stored read grant** (the coarse/legacy form of a class-read grant): `private` = no class-read grant, `public` = a class-read grant. Folds into the *stored* part of the composed `permissions` value (§I composition).

## D. Not axes at all — adjacent layers (things `type` also silently carried)

- **Unit / offering configuration** (references axes): which kinds a unit provisions on startup; likely `showInSortWork` membership; possibly which kinds exist.
- **The `kind` registry** (the demoted `kind`): named bundles of axis-defaults (creation), **copy-target** and **publish-target** templates, and **presentation config**. The stored `kind` tag is also the **migration cohort key** — find all docs of a kind to re-apply changed defaults (O6).
- **Presentation config** (keyed by kind/preset): labels, title-bar choice, CSS.
- **Non-document context**: viewer role / group membership; workspace mode (comparison, 1-up/4-up).

## E. Overlap & derivability analysis — the reason for this document

Each item is a place two or more axes might be the same thing, one derivable from another, or one better modeled inside another. Each got a tentative read — **[independent]**, **[partial overlap]**, or **[consolidate?]** — and was then worked through; the resolution is recorded inline per item (§F summarizes).

- **O1 — `canonical` ↔ `concurrent` ↔ `owner==none` ↔ `kind==group`.** **[independent, currently collinear]**
  All four are true only for `group` today, so they look interchangeable. They decouple the moment
  `problem`/`planning` become canonical-but-single-writer, or a class-collaborative (ownerless, non-group)
  doc appears. Keep all four. (This is finding C2.)

- **O2 — `concurrent` ↔ `permissions.writePolicy`.** **[partial overlap]** A `concurrent` doc necessarily has a
  multi-writer `writePolicy`, but the reverse fails: several people could be *allowed* to write a doc that
  still uses last-write-wins rather than concurrent merging. So `concurrent` (the *merge mechanism*) is
  distinct from `writePolicy` (*who may write*), but implies a multi-writer write grant. Keep the two concepts
  separate. **Resolved: `concurrent` stays a stored per-doc axis** (not a `kind` lookup). Although its value is
  currently constant per kind, concurrent documents carry **special stored metadata state** (concurrent
  history, canonical pointer, group association), and storing the flag makes that state association explicit —
  and lets rules read it. (Changing which kinds are concurrent would be a history-*format* migration
  regardless, so the stored-flag migration cost is not the binding constraint.)

- **O3 — `owner` ↔ `permissions`. → RESOLVED: keep `owner` separate (identity / provenance).** `owner` is **not**
  a subset of `permissions`:
  1. **Provenance persists beyond permissions.** A frozen publication retains `owner` = the publisher even though
     the publisher has *no* write access to it (§H). So `owner` ≠ "who may currently write" — it is
     authorship/provenance that outlives permissions.
  2. **`permissions` grants *reference* `owner`.** "The owner may unpublish/edit" needs `owner` as a known identity
     to point at; `owner` is an **input** to `permissions`, not itself a grant.
  3. **Attribution/identity.** "Whose doc is this" (display, unpublish authority, accounting) is used
     independent of permissions.
  Relationship: the owner's *default* permissions (e.g. all-permissions on an editable doc) are a `permissions`
  grant to the owner principal, supplied by the kind's creation template; the `owner` **identity** is a
  separate stored field. Also distinct from `scope` — coincides with scope's user-association for unpublished
  docs but **diverges** for publications (scope broadens to offering/class; owner stays the publisher). So
  `owner` sits between `scope` (position) and `permissions`, carrying provenance, irreducible to
  either. **Stays a stored per-doc axis.**

- **O4 — `location` ↔ `permissions`. → REVISED (see §H): remove *addressing*, keep *scope*.** `location` carried
  two things:
  - **Addressing disappears.** Firestore metadata is already a flat `documents/{key}` collection keyed only
    by documentKey; the ideal world removes RTDB metadata entirely, so there are no paths
    left to encode. ✓ removed.
  - **Scope/context survives** as explicit **context-association references** (`{class, offering?, group?,
    user?}`). It is *not* fully absorbed by `permissions`: permissions can name group/class principals, but there is
    **no `offering` principal**, so "belongs to offering X" is irreducible data (§H). The human labels
    ("user-in-offering") are *derived* from which associations are set.
  So the earlier "drop `location`" was too strong: keep a **`scope`** element (context associations); only its
  storage-path role is gone. This neither solves nor worsens RTDB *content* enforcement (§G).

- **O5 — `publishable` / `copyable` ↔ `permissions`. → RESOLVED: fold into `permissions` as permissions.** Publish and
  copy are *operations allowed to specific people* — i.e. **permissions**. So `permissions` include
  operations, not just read/write: `{read, write, publish, copy, delete, …}`. "May actor X publish doc Y" is
  a grant; "planning is not publishable" is simply no `publish` grant existing on planning. `publishable` /
  `copyable` are therefore **not** document axes. Two clarifications:
  - The **result** of a copy/publish (what the new doc looks like) is a per-kind **template** in the preset
    registry (copy-target, publish-target — see O6), *not* part of `permissions`. Permissions say *who may*; the
    template says *what comes out*.
  - Publish is, in a sense, *copy with a specific template* (wider-audience grant + `frozen`). We keep `copy`
    and `publish` as **separate operations/permissions** anyway, for clarity — distinct grants even though
    publish could be expressed as a specialized copy.

- **O6 — `kind` ↔ creation-preset name ↔ presentation-config key. → RESOLVED: one stored registry key.**
  There is a single kind-like field — a **registry key / preset tag** that supplies presentation config,
  creation defaults, and copy/publish templates (O5). It is **not** a runtime behavior discriminator (runtime
  logic reads the explicit properties, not `kind`). **But `kind` is still stored on each document**, and that
  gains a role we would otherwise lose: it is the **migration cohort key**.
  - Today, changing the code for a `type` instantly changes behavior for *every* doc of that type — behavior
    lives in code, so there is nothing to migrate. Once behavior is per-document data, changing a kind's
    intended settings requires **migrating existing documents**, and the stored `kind` is the handle: *find
    all docs of kind X and update property Y*. Without a stored `kind`, that cohort would be unfindable.
  - So `kind` survives as **stored metadata** with four uses — presentation, creation defaults, copy/publish
    templates, and **migration cohorts** — and **zero runtime branches**. (Per-doc overrides vs. cohort
    defaults is a migration-policy detail: a migration must decide whether to overwrite docs that have been
    customized away from the old default.)
  - **Tradeoff to record:** the decomposition swaps *"change behavior once in code, instantly, for all docs"*
    for *"explicit per-doc data + a migration when a cohort's settings change."* `kind` is what keeps that
    migration tractable.

- **O7 — surface-membership properties (`showInSortWork`, Student-Work, nav tabs). → RESOLVED: none are
  stored axes (see §I).** All are "does this doc appear in UI surface X," and each resolves without per-doc
  storage: `showInSortWork` is **constant per kind** → a `kind`/unit **registry lookup**; Student-Work is a
  **derivation** (`kind` = problem + `owner` ≠ viewer); nav My/Class is a **derivation** (`frozen`+`owner`).
  So the two §B candidates both dissolve — one lookup, one derivation — and none belong on the document.

- **O8 — `permissions.frozen` ↔ `permissions.writePolicy`.** **[already folded]** `frozen` = `writePolicy` with no
  write grant on content. It is a *value* of the write dimension, not a separate axis — already unified under
  `permissions`. Listed for completeness so it isn't re-introduced.

## F. Open questions / gaps to check as a whole

1. Is the **set complete**? Every branch we inventoried maps to something above — but we only inventoried the
   client, `firestore.rules`, and functions. RTDB `.validate` rules and any authoring-side type logic were
   not fully swept. Possible missed axis?
2. ~~Does `kind` survive?~~ **RESOLVED (O6): yes, as stored metadata** — a registry/preset + cohort tag
   (presentation, creation defaults, copy/publish templates, migration cohorts); never a runtime branch.
3. ~~Should `location` survive?~~ **REVISED (O4 / §H): split** — storage-path/addressing removed, but
   **`scope`** (context associations) is retained, because the *offering* association is not expressible in
   `permissions`.
4. ~~Do `publishable`/`copyable` become permissions?~~ **RESOLVED (O5): yes** — folded into `permissions`
   as `publish`/`copy` permissions; the result-template lives in the preset (O6).
5. ~~UI-surface memberships — axes or config?~~ **RESOLVED (O7 / §I): not stored axes** — `showInSortWork` is
   a `kind`/unit lookup; Student-Work and nav are derivations.
6. ~~`owner` vs `permissions` (O3)?~~ **RESOLVED (O3): two** — `owner` is a separate identity/provenance field that
   `permissions` grants reference; it persists beyond permissions (frozen publications keep their owner).
7. ~~Is `concurrent` stored or a lookup?~~ **RESOLVED (O2): stored** — kept as a stored per-doc axis because
   concurrent docs carry special stored state (the flag marks that association and is rule-readable), even
   though the value is currently constant per kind. *(All overlaps O1–O8 now resolved or confirmed-independent.)*

**Where it lands (by mechanism — §I).** With O4 revised (scope kept) and O5/O6/O7 resolved, the set separates
by *how* each thing is realized, which is more useful than one flat list:
- **Stored per-doc axes** (vary per doc, or mark stored state / need rule-readability; rules can read them):
  **`canonical`, `owner`, `scope`, `permissions`, `concurrent`** — plus the **`kind`** tag.
- **Looked up by `kind`** (constant per kind; no storage, no migration): presentation, creation defaults,
  copy/publish templates.
- **Derived** (from other fields/context): nav routing, Student-Work, 4-up, content-monitoring,
  `showInSortWork`.

So the genuinely-stored, per-document set is **`canonical`, `owner`, `scope`, `permissions`, `concurrent`** (+ the
`kind` tag) — still markedly smaller than the running tally, because most "axes" turn out to be registry
lookups or derivations, not stored data. With O3 and `concurrent` resolved, this is **final**: the overlap
analysis (O1–O8) is complete.

## G. Punted issues (deferred under the ideal-world framing)

- **Enforcing access to document *content* in the RTDB.** `permissions` grants describe policy, but the RTDB
  enforces nothing per-doc today. Removing `location` neither creates nor solves
  this — the gap already exists. Deferred: migrate content access to Firestore, or add RTDB `.validate`
  enforcement. Out of scope for the axis model.
- **Migration cost / data backfill** for any consolidation here (removing `location`-as-path, folding
  `publishable`/`copyable` into `permissions`, etc.) — not estimated in this document.
- **Ongoing migration cost** the model introduces: because behavior becomes per-doc data, changing a kind's
  defaults later requires migrating that cohort (O6) — a permanent tradeoff vs. today's change-the-code-once.
  The stored `kind` tag keeps it tractable, but it is a real recurring cost to weigh.

## H. Scope walkthrough (does removing `location` lose scope reasoning?)

Concern: `location` doubled as **scope** — the human-friendly "user-in-offering" labels — and losing those
labels makes reasoning harder. Walking each label through shows the resolution: **the storage-path meaning of
`location` is removed, but scope survives** as a small set of **context-association references** (which class /
offering / group / user the doc is attached to). The labels are *derived* from which associations are set.

Scope spans **two hierarchies** — **org** (`network ⊃ class ⊃ offering ⊃ group`, plus `user`) and
**curriculum** (`unit ⊃ problem ⊃ section`). An *offering* bridges them (it assigns a curriculum problem to a
class), so offering-scoped docs inherit a curriculum position. A document attaches to whichever apply — and
**`class` is optional: curriculum/exemplar docs are class-less**, rooted in the curriculum hierarchy (± network).

| scope label | network | class | offering | group | user | curric. pos | canonical | example kinds |
|---|---|---|---|---|---|---|---|---|
| user-in-offering | — | ✓ | ✓ | (owner's) | ✓ owner | ✓ (via offering) | yes (intended) | problem, planning |
| user-in-class | — | ✓ | — | — | ✓ owner | — | no (collection) | personal, learningLog |
| group-in-offering | — | ✓ | ✓ | ✓ | — | ✓ (via offering) | yes | group |
| offering (publication) | — | ✓ | ✓ | (opt) | owner retained | ✓ | no, frozen | problem publication |
| class (publication) | — | ✓ | — | — | owner retained | — | no, frozen | personal/learningLog publication |
| **curriculum comment anchor** | ✓ *(or teacher user)* | **—** | — | — | (teacher, opt) | ✓ | — | curriculum doc |
| **exemplar** | — | **—** | — | — | (synthetic author) | ✓ | — | exemplar *(per-student visibility is `permissions`, not scope)* |

The label is just a name for "which associations are set": *user-in-offering* = user + offering;
*user-in-class* = user + class, no offering; *group-in-offering* = group + offering, no user-owner; etc.

**Reasoning cases, handled via the associations (no storage path needed):**
- *"Which assignment/offering is this tied to?"* → the **offering** association (unset ⇒ not offering-scoped).
- *"List all problem docs in this offering."* → docs with `offering = X` and `kind = problem`.
- *"Show this user's group's 4-up."* → the **group** association (+ offering) → the group members' problem docs.
- *"Is this a per-class doc, not tied to an assignment?"* → **offering** unset (personal, learningLog).
- *"Publications."* → **owner** retained (authorship, for attribution/unpublish) while the **scope** broadens
  (offering or class), `permissions` opens to class-read, and `frozen`. Owner and scope **diverge** here — which is
  exactly why they are separate concepts.

**Key finding — scope is *not* fully absorbed by `permissions`.** Permission grants can name *group* and *class*
principals (so those associations overlap with permissions), but there is **no `offering` principal** — nothing in
"who may read/write" encodes "belongs to offering X." So the **offering association is irreducible scope
data**, distinct from `permissions`. O4's strong form ("remove `location`") was therefore too strong.

**Revised position (supersedes the strong form of O4):** keep a **`scope`** element = the doc's context
associations across **both hierarchies** — org `{network?, class?, offering?, group?, user?}` and curriculum
`{unit?, problem?, section?}`. Storage-path/addressing is gone; the reasoning labels ("user-in-offering") are
retained as *derived views* of the associations. Because `class` is **optional**, curriculum/exemplar are no
longer a ragged edge — they are **class-less, curriculum-rooted** scopes (± network). `owner` stays separate
(authorship/authority — coincides with the user-association for unpublished docs, diverges for publications,
synthetic for exemplar). The only genuine outside-the-model residue is the exemplar's per-student
*visibility*, which is `permissions` (subject-indexed grants), not scope.

## I. How each property is realized: stored, looked-up, or derived

A property does **not** have to be stored on the document. There are three mechanisms, and the choice
determines whether changing it needs a migration:

| mechanism | where the value lives | changing it | per-doc variation | rules can read it |
|---|---|---|---|---|
| **Stored** (per-doc axis) | on each document | migrate existing docs (new docs get the new default) | yes | yes |
| **Looked-up by `kind`** (registry) | in the kind registry | change once → all docs instantly (like code today) | no | not directly (not on the doc) |
| **Derived** | computed from other fields / context | change the formula | n/a | via its inputs |

**Correction to O6's framing:** only **stored** per-doc values incur migration. The registry config —
presentation, creation defaults, **copy/publish templates** — is **looked up by `kind`**, so changing it needs
**no migration**. O6's migration cost applies **only to the axes we choose to store per-doc**.

**Composition (refinement):** an axis can *combine* mechanisms. **`permissions` is composed** — its effective
value is merged at runtime from **permission-policy grants** (the shared rules of a named **permission policy**
the document references — changeable with no migration) **+** **per-doc grants** (stored — only the parts that
genuinely vary: the `visibility` share toggle, a support's audience, exemplar visibility). The shared rules
live in a policy instead of being copied onto each document, so they stay central and migration-free; and
because the document stores the policy *name*, security rules read it too — keying their own copy of the
policy's rules off that name rather than doing a `kind → defaults` lookup, which is what makes the kind-default
portion rule-enforceable (§G).

**Which mechanism for each:**
- **Stored per-doc axes**: `canonical`, `owner`, `scope`, `concurrent`, and the **per-doc grants of `permissions`**
  (its shared grants come from a referenced permission policy — see Composition). Plus the `kind` tag.
- **Looked up by `kind`** (constant per kind): presentation, creation defaults, copy/publish templates.
- **Derived**: nav My/Class (`frozen`+`owner`), Student-Work (`kind`+`owner`≠viewer), 4-up
  (`scope`+`canonical`+`permissions`+context), content-monitoring (`permissions`), `showInSortWork` (a `kind`/unit
  lookup — O7).

The design question for any behavior is: **does it vary per document?** Yes → store it (accept migration).
Follows from other fields → derive it. Constant per kind → *default* to a lookup (no storage, no migration) —
**but store it anyway when** the flag (a) must be **readable by security rules**, or (b) **marks associated
stored state** on the doc. `concurrent` is the example of (b): its value is constant per kind, yet concurrent
docs carry special stored metadata (concurrent history, canonical pointer), so the stored flag makes that
association explicit (O2). So "constant per kind" is a guideline toward lookup, not an absolute.
