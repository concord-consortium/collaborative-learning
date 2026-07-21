# Document Axes: from types to behavior

Today we reason about CLUE documents by **type**: "a problem document", "a group document",
"a publication". But a type is not one thing — it is a *bundle* of behaviors. "Problem document"
silently means *this user's single primary workspace for one assignment, editable only by them,
readable by their teacher, shareable to their group*. Every one of those clauses is a separate
decision, and different types make them differently.

This document names those decisions as **axes**. Instead of asking "what type is this document?", we
describe a document by **where it sits on each axis** — who owns it, where it is scoped, whether it is
the canonical doc for its slot, whether it is multi-writer, who may do what to it. The type becomes
just one of those axes (`kind`), not the thing everything hangs off.

**These axes are "virtual" today.** The current code does not store most of them as fields. But its
*behavior* already fixes a value for every axis on every document — the four-up share toggle, the
read-only publication, the group's shared editing — so the axes are already there, encoded in how
CLUE acts rather than in what it stores. This doc reads each axis *out of* that behavior. The
refactoring tracked in this folder then makes the axes explicit; see
[target-architecture.md](./target-architecture.md).

> This doc is the plain-language definition of the axes, grounded in current behavior. The current-state
> evidence (per code site) that backs it lives in the findings doc on the `document-type-decomposition`
> branch.

## The six axes

### `owner` — authoring identity and provenance

**What it is.** *Whose document this is* — the authoring identity, used for attribution and for
authority like "the owner may unpublish". It is not "who may write" (that is `permissions`); provenance
outlives permission.

**In today's behavior.** Most documents are owned by the student or teacher whose `uid` created them.
Two tells that `owner` is its own thing:
- **Group documents have no personal owner.** They live under a synthetic group user
  (`group_{offeringId}_{groupId}`), so no single student is "the owner" — which is exactly why a group
  doc's ownership behaves unlike a personal doc's.
- **Publications keep their author after they leave that author's control.** A published document is a
  frozen copy the publisher can no longer edit, yet it still "belongs to" them for attribution and
  unpublish authority. Owner persists past write access.

### `scope` — where the document is attached

**What it is.** The document's position in the org hierarchy (network / class / offering / group / user)
and the curriculum hierarchy (unit / problem / section). A document attaches to whichever of these
apply; the familiar labels ("this user's doc in this offering") are just names for which associations
are set.

**In today's behavior.** Scope is visible in *where CLUE looks for a document* and *when it applies*:
- A **problem** or **planning** document is scoped to *one user in one offering* — you get a fresh one
  per assignment, and it does not follow you to a different problem.
- A **personal** document or **learning log** is scoped to *the user in the class*, with no offering —
  which is why it is available across problems and used to carry notes between them.
- A **group** document is scoped to *the group in the offering* (no single user).
- A **publication** broadens scope to the whole offering or class while its `owner` stays the
  publisher — `owner` and `scope` diverging is the signature of publishing.

**Scope also defines `canonical` slots.** A canonical slot *is* a scope that at most one document is
expected to fill — "the problem doc for this user in this offering", "the group doc for this group"
(see `canonical`).

**Scope also feeds `permissions`.** Scope is not purely positional. Its **class** and **group** associations
double as *permission principals*: "readable by the class" means readable by whoever shares the document's
class scope, and "readable by the group" means the members of its group scope. So when a publication
opens to the class, or a group document is read and written by its members, the audience is being named
*by scope*.

### `canonical` — the single doc for a slot

**What it is.** Whether this is *the* one document expected to fill a given **scope** slot, as opposed
to one of a growing collection.

**In today's behavior.** Some documents are singletons, some are collections:
- A user is meant to have **exactly one** problem document per offering (and a teacher one planning
  document) — the primary workspace. It is canonical *by convention*; the database does not enforce it,
  and bugs have produced duplicates, which is precisely the fragility making `canonical` worth naming
  explicitly.
- A group has **one** group document per offering — canonical, and here backed by a real pointer.
- **Personal** documents and **learning logs** are the opposite: a user may create as many as they
  like. There is no single canonical one — the slot is a collection.
- **Publications** are non-canonical and versioned: publishing the same document repeatedly stacks up
  versions, and the UI simply shows the most recent.

### `concurrent` — multi-writer vs single-writer

**What it is.** Whether the document supports *several people editing at once* (merged through the
concurrent history manager) or is written by one editor at a time.

**In today's behavior.** This axis is almost entirely collinear with "is it a group document":
- **Group** documents are the multi-writer case — every member of the group edits the same document,
  which is what the concurrent history machinery exists to support.
- **Everything else** is single-writer: one owner edits, and other viewers (teacher, classmates via a
  publication or share) only read.

Because only group docs are concurrent today, the current code can and does test `type === "group"`
wherever it means "concurrent". Naming `concurrent` separately is what lets a *non-group* document
become multi-writer (the direction CLUE-550 is heading) without every such site having to learn about
a new type.

### `kind` — the preset a document was made from

**What it is.** `kind` is another name for the document's `type`. Every other axis on this list
describes how a document *behaves*; once those behaviors are read from the axes, the one thing `type`
still carries is the identity of the **preset** a document was made from. `kind` is that leftover tag.

**Why it still exists.** The whole point of this reframing is to stop reasoning about a document by its
type and to reason about its axes instead — so it is fair to ask why a type-shaped field survives at
all. It survives because a few things are genuinely *per-preset* and cannot be read off how a document
behaves:
- **Creation** — when a new document is made, something has to choose its starting axis values. "A new
  problem is owned by its creator, scoped to this offering, canonical, single-writer, teacher-readable"
  is a recipe belonging to a preset; the axes describe the result but cannot supply it.
- **Presentation** — the label a document is shown under, its title bar, its icons and styling are
  chosen per preset, not consequences of its axis values.
- **Copy and publish** — what a copy or a publication of a document should look like (which axes change,
  which carry over) is a per-preset recipe.
- **Permission defaults** — the baseline of who may do what (e.g. "the owner may read and write, the teacher
  may read") is shared by every document of a kind. Rather than copy those rules onto each document, a kind
  points the document at a named **permission policy** (see `permissions`), and several kinds can share one
  policy — personal and learning-log documents use the same rules. The per-document grants that genuinely
  vary — a share toggle, a support's audience — combine with the policy to give the effective `permissions`.

So `kind` is the name of that preset — the one place the old idea of `type` legitimately remains, no
longer as something logic branches on but as the tag saying which recipe a document came from.

That baseline is not copied onto each document; it lives in the shared permission policy the document
references, so it can be changed in one place — for every document at once — without a migration.

This is why `kind` has to be described with care. Nothing branches on `kind` at runtime — no logic asks
"what kind is this?" to decide what to do — so it carries no behavior of its own. But it is not inert:
through these defaults it *defines* behavior, stated in the vocabulary of the other axes. It sets what a
new document's axes start as, and supplies the permission baseline those axes compose with.

**In today's behavior.** `kind` has no distinct analog today. Because `type` *is* the logic, CLUE never
needed a separate preset concept — `type` does both jobs at once. The part that already echoes `kind` is
**presentation**: labels, title bars, and styling are already chosen from a document's `type`. Creation
defaults, the permission baseline, and copy/publish templates have no separate existence today; `type` and
the code around it supply them implicitly.

### `permissions` — who may do what

**What it is.** The permission set: who may `read`, `write`, `publish`, `copy`, and whether the content
is `frozen` (no writer at all). It is *composed* — the shared defaults come from a **permission policy**
(which the document's `kind` selects), and only the parts that genuinely vary per document are stored (the
share toggle, a support's audience, an exemplar's per-student visibility).

**In today's behavior.** `permissions` is the busiest axis, and its behavior is spread across the most
features:
- The **four-up share toggle** on a problem document is a `permissions` change — flipping a class/group
  read grant on and off (the stored `visibility` field).
- A **publication** is a frozen snapshot with a widened read grant (the class can read; nobody can
  write; the owner may unpublish).
- A **group** document grants read and write to every group member.
- A **multi-class support** grants read to a structured target audience across classes.
- An **exemplar** grants read per student.

Several of those audiences are named *by `scope`*: "the class can read" and "group members can
read/write" resolve through the document's class and group associations. `permissions` supplies the *verbs*
(read / write / publish / copy) and the per-document toggles; `scope` supplies *which* class or group
those grants point at.

Because `permissions` blends kind-defaults with a few stored per-document grants, it is the axis that
resists being flattened into a single label — see the shorthand caveat on the table below.

**Named permission policies.** The shared part of a document's permissions — everything that is the same
for all documents governed alike — is organized into named **permission policies**: code-defined bundles
of permission rules that a document *references* by name. A policy is written once and pointed to by many
documents, and more than one `kind` can use the same policy (personal and learning-log documents want the
same rules). Because the reference is a stable name and the rules themselves live in code, both the app
and the Firestore security rules resolve the name to the same rule set — the rules match on the policy
name and never branch on `kind`. Changing a policy's rules changes every document that references it, with
no migration; the per-document grants that genuinely vary still live on the document and combine with the
policy. (This is a structure *within* `permissions`, not a separate axis.)

## Where today's types land

This table is a **snapshot of how each current type sits on the axes** — useful for seeing that the
axes are already present, but *not* the definition. The point of this doc is the axes; the types are
just where today's behavior happens to have placed things. `permissions` is collapsed to a short label
because its real value (a composed grant set) does not fit a cell.

| kind (`type`) | owner | scope | canonical | concurrent | permissions (shorthand) |
|---|---|---|---|---|---|
| `problem` | student/teacher | user-in-offering | yes (by convention) | no | owner + teacher read; group-read when shared |
| `planning` | teacher | user-in-offering | yes (by convention) | no | owner + teacher read |
| `personal` | student/teacher | user-in-class | no (collection) | no | owner + teacher read; class-read when public |
| `learningLog` | student/teacher | user-in-class | no (collection) | no | owner + teacher read; class-read when public |
| `group` | none (group user) | group-in-offering | yes (pointer) | **yes** | all group members read/write |
| `problem` publication | publisher (retained) | offering | no, versioned | no | class read; frozen |
| `personal`/`learningLog` publication | publisher (retained) | class | no, versioned | no | class read; frozen |
| `support` (multi-class) | teacher (retained) | multi-class / offering | no | no | target audience read; frozen |
| `exemplar` | synthetic author | class-less, curriculum-rooted | no | no | per-student read |

Reading the table the new way: a "group document" is not a special *kind of thing* — it is simply the
document that happens to be *ownerless, group-scoped, canonical, concurrent, and group-read/write*. Any
other document that took those same axis values would behave the same way. That is the shift this
folder is built around.

## Relationship to the other docs here

- [target-architecture.md](./target-architecture.md) — how the axes will live in code: getters on
  `DocumentModel`, the `kind` registry, behavior modules, and the one creation factory that turns
  `kind` into axis values.
- [README.md](./README.md) — the roadmap and status of making each axis explicit.
