# Document Axes: from types to behavior

Today we reason about CLUE documents by **type**: "a problem document", "a group document",
"a publication". But a type is not one thing — it is a *bundle* of behaviors. "Problem document"
silently means *this user's single primary workspace for one assignment, editable only by them,
readable by their teacher, shareable to their group*. Every one of those clauses is a separate
decision, and different types make them differently.

This document names those decisions as **axes**. Instead of asking "what type is this document?", we
describe a document by **where it sits on each axis** — who owns it, where it is kept, what content it
is about, whether it is the canonical doc for its slot, whether it is multi-writer, who may do what to
it. The type becomes just one of those axes (`kind`), not the thing everything hangs off.

**These axes are "virtual" today.** The current code does not store most of them as fields. But its
*behavior* already fixes a value for every axis on every document — the four-up share toggle, the
read-only publication, the group's shared editing — so the axes are already there, encoded in how
CLUE acts rather than in what it stores. This doc reads each axis *out of* that behavior. The
refactoring tracked in this folder then makes the axes explicit; see
[target-architecture.md](./target-architecture.md).

> This doc is the plain-language definition of the axes, grounded in current behavior. The current-state
> evidence (per code site) that backs it lives in the findings doc on the `document-type-decomposition`
> branch.

## The seven axes

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

#### What the owner axis has to support

Stated independently of how the owner is stored, so a change of representation can be checked against
this list. Most entries are behavior CLUE has to support however it is built. A few instead record a
constraint the current implementation imposes; those are marked *Note*, and each says what it would
take to lift it — they bound today's choices without being requirements in their own right.

**Assigning**

1. **Resolve an owner at creation from the kind.** A kind declares whether its documents are owned by
   the creating user, their group, or the class; creation turns that declaration into a concrete owner.

**Authorizing**

2. **Decide whether the authenticated user is the owner.** The Firestore rules compare a user-owned
   document's owner against the JWT's `platform_user_id`.
3. **Distinguish "owned by no user" from "owned by a different user".** A group or class owned
   document must never satisfy (2) for anybody. In other words the `platform_user_id` check can't match a
   group or class owned document. Put another way, this is one of the reasons the combination of owner type and owner id
   needs to be unique within the authentication domain. *A side note*: Because we can't tell directly if a user
   can edit a group or class owned document, in the Firestore rules concurrent documents need their own
   check to see if a user can add a history entry.
4. **Decide whether the current user belongs to the group that owns a document** — the gate on editing
   a group document. Group ids repeat across offerings, so the same number names a different set of
   students in each; this check has to be specific to one offering, which means the owner must carry
   enough to identify the offering. Documents from other offerings do reach this check, because Sort
   Work's "All" filter lists everything the class has produced.

**Addressing**

5. **Locate a document's content by its owner.** RTDB stores content at
   `classes/<class>/users/<owner>/documents/<key>`, so an owner must serialize to a single key-safe
   path segment — RTDB keys exclude `.` `$` `#` `[` `]` `/`. *Note*: this is an implementation detail,
   so we could decide to change it, but that would require a large migration.
6. **Address a document's canonical-pointer slot by its owner.** A pointer path carries the owner as a
   single segment — the document's `uid` verbatim, synthetic owners included:
   `canonical/v1/classes/<class> / [offerings/<id> | units/<unit>] / owners/<uid> / slots/<label>`. The
   offering in that path is the document's container, not something read back out of a group owner's
   id, and no segment names the group. The client and the Firestore rules build the path independently
   and have to agree on it, and the rules have only the document's stored fields to work from — so an
   owner has to serialize to one Firestore path segment they can use. *Note*: this is also an
   implementation detail. It is a new feature (2026-07), so could be revised.

**Attributing and organizing**

7. **Read a document's owner type directly off the document.** This is the requirement that most
   constrains the representation, so it is worth stating concretely.

   The Sort Work tab can section documents by group or by name. Each view walks the whole list of
   documents the class has produced and must place *every* one of them. Both branch three ways on the
   owner type, and each branch resolves something different:

   | owner type | sectioned by group | sectioned by name |
   |---|---|---|
   | group | `Group <N>` — the document's group | one entry under **each member** of that group |
   | class | `Whole Class` — a fixed section | `No Name` — the class is not a person |
   | user | `Group <N>` — whichever group its owner belongs to *now* — or `No Group` | the owner's `Last, First` |

   Three things follow. The owner type selects *which lookup to perform* — a group registry lookup, a
   name lookup in the class, or no lookup at all — so it has to be known before any id is resolved. A
   user-owned document is placed indirectly, by its owner's current group rather than by anything the
   document itself records, so the owner type also decides whether the document or its owner's present
   state supplies the answer. And when sectioning by name, a group-owned document is emitted **once per
   member** while the other two are emitted once — so the owner type changes the shape of the output,
   not just the label.

   The view iterates documents it did not choose and cannot anticipate, including documents from other
   units and offerings. It needs the owner type as a value it can read from each document, the same way
   it reads a title.
8. **Resolve a group owner to its group's members** — for listing a group document under each student
   who worked on it. The members come from a group registry maintained for the **current offering**.
   The "Group N" label is not part of this: sectioning by group takes the number from the document's
   stored group id, so it resolves nothing and works for a document from any offering.
9. **Resolve a user owner to their name in the class** — for the "Last, First" section label.

**Locating**

10. **Find a group's document from before canonical pointers existed**, by class, offering, and group.
    This is the only query anywhere that filters on an owner, and it is transitional — it retires with
    the canonical-pointer migration.

#### Not required today

**No query filters documents by owner.** Sort Work fetches by class and by curriculum position (unit,
investigation, problem), then sections what it receives. Neither the owner type nor the owner id is
ever a query term, apart from the transitional case above.

Worth stating explicitly, because it means the owner representation does **not** have to be queryable
by type today. If that changes, it becomes the strongest argument for a stored owner type.

#### Limitations

- **A group owner outside the current offering does not resolve.** Requirement 8 resolves only against
  the current offering, so a group-owned document from an earlier one — visible under Sort Work's "All"
  filter — does not know its members. Sectioning by name cannot list it under anybody, so it is filed by
  where the work came from ("Groups from `<problem>`") rather than under this offering's group of the
  same number, whose students did not write it. Lifting this needs a group registry that spans
  offerings, not a change to how the owner is stored: the owner already identifies its offering.

  **Sectioning by group is deliberately unaffected.** It needs only the group's number, which it takes
  from the stored group id without resolving anything, so a document from another offering sections
  under the same `Group <N>` section that a document from the current offering does. The two sorts
  differ here because they are claiming different things: a group number is a label that reads the
  same in every offering, while a student's name asserts *who did this work* — so the sort that cannot
  answer that truthfully declines to answer it at all. Requirements 8 and 9 carry that asymmetry: only
  the by-name sections resolve an owner to people. This approach of mixing different groups under the
  same `Group <N>` section might change in the future.

#### Possible future requirements

- **Query by owner type** — a view that fetches only class-owned documents, or trims payload by owner.
  This would be needed if the current client-side approach isn't sufficient.
- **More owner types** — a school, a network, a teacher cohort.
- **Group-level authorization in the rules.** A group document's history is currently authorized
  class-wide because the auth token carries no group id. If tokens ever carried one, the rules would
  have to recover the group from the owner.
- **Owner transfer.** Because permissions are computed *from* the owner, reassigning it changes who
  may act; it would need a privileged path rather than an ordinary update.

### `container` — where the document is kept

**What it is.** The place a document belongs to, in a strict nesting: **class → classUnit →
offering**. A classUnit is one class working through one unit. An offering is one assignment of one
problem to that class, and every offering falls inside exactly one classUnit. Each document sits at
exactly one of these, and never moves.

**In today's behavior.** The container is visible in *how long a document stays with you*:
- A **personal** document or **learning log** is kept by the class. It is available no matter which
  unit or assignment you are working on, which is why it is used to carry notes between problems.
- A **class-wide collaborative** document (the driving question board) is kept by the class *and* the
  unit — one per class per unit. Move to another unit and you get a different one.
- A **problem** or **planning** document is kept by the assignment. You get a fresh one per
  assignment, and it does not follow you to a different problem.
- A **group** document is kept by the assignment too — its group-ness is *whose* it is, not where it
  is kept.

**Neither the user nor the group is a level here.** It is tempting to continue the nesting downward,
since students are in groups and groups are in assignments. But a container has to be stable for as
long as the things in it: group membership changes during an assignment and differs between
assignments, and a single student's documents are kept at several different levels rather than under
one place of their own. *Whose* a document is belongs to `owner`.

**The container defines `canonical` slots.** A canonical slot is a container plus an owner plus a
label — "the group document for this group in this assignment", "the driving question board for this
class in this unit" (see `canonical`).

**The container names permission principals.** "Readable by the class" means readable by whoever
shares the document's class. So when a publication opens to the class, the audience is being named by
where the document is kept. (Group-based audiences work the same way, but the group comes from
`owner` rather than from the container.)

### `curriculum` — what content the document is about

**What it is.** Where the document sits in the curriculum: **none → unit → investigation →
problem**. This is what the document is *about*, not where it is kept.

**In today's behavior.** The curriculum position is visible in *when a document is offered to you*:
- A **personal** document or **learning log** has no curriculum position at all — it is not about any
  particular content.
- A **class-wide collaborative** document is about a whole unit.
- A **problem**, **planning**, or **group** document is about one problem.
- An **exemplar** is about one problem — it is authored into the curriculum alongside that problem.

It is also what the Sort Work filters match on: choosing an investigation or a problem narrows the
list to documents about that part of the curriculum.

**Why this is separate from `container`.** For most documents the two line up — kept by the class and
about none of it, kept by a classUnit and about that unit, kept by an assignment and about that problem.
Exemplars are the case that comes apart: an exemplar is about a specific problem, but it is not part
of any assignment. It exists whether or not the class has ever been assigned that problem, so there is
no assignment to keep it in. A document can be about a problem without being kept in that problem's
assignment.

A **publication** shows the same independence from the other direction: publishing broadens who can
see a document without changing what it is about, while its `owner` stays the publisher — `owner`,
`container`, and `curriculum` moving separately is the signature of publishing.

### `canonical` — the single doc for a slot

**What it is.** Whether this is *the* one document expected to fill a given **container** slot, as
opposed to one of a growing collection.

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
  problem is owned by its creator, kept by this assignment, about that problem, canonical,
  single-writer, teacher-readable"
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

#### Static and dynamic kinds

A preset does not have to be written in code. Kinds come from two sources:

- **Static kinds** are registered by the application itself. They exist for the whole session, everywhere,
  and are the same for every user.
- **Dynamic kinds** are declared in configuration that is loaded at runtime — today, a unit's
  `classWideDocuments`, which registers a kind when that unit loads. This is what lets "add another
  class-wide document" be an authoring change rather than a code change, and it is the direction the
  roadmap wants: a preset is data.

Dynamic kinds carry a constraint that static kinds do not, and it is a property of *where the definition
is loaded from*, not of the kind itself: **a dynamic kind's definition is only present when its
configuration is loaded.** Only the current unit's config is loaded, so for a unit-declared kind the
definition is absent for every document from any other unit — while those documents remain visible, because
Sort Work's unfiltered view spans every unit a class has worked through.

Two rules follow, and both are really the same rule — *a document must remain interpretable without its
kind's definition*:

1. **Anything a dynamic kind supplies must be stamped at creation or degrade gracefully.** Values the
   definition contributes to a document's axes are written onto the document, so they survive the
   definition's absence. Anything not stamped — presentation, above all — must have a fallback derived from
   stored fields alone. This is the same reason consumers read a document's container and curriculum
   from its stored associations rather than through the registry.
2. **A dynamic kind's documents must carry the association that identifies the configuration that defined
   them.** For unit-declared kinds that association is `unit`. Kind names are not globally unique across
   configurations — two units may declare the same kind with different wording — so without it there is no
   way to tell whether a definition found under that name is the one the document was made from, and the
   wrong definition would be applied confidently.

   `getKindDefinitionFor(doc)` is where this rule lives in code: it is the one way to read a kind definition
   off an existing document, and it compares the two associations before returning anything. Creation looks
   kinds up by name instead (`getDocumentKindInfo`), which is sound because a document being created takes
   its kind from the configuration in hand. Keeping every read behind one function is what makes rule 1's
   fallback obligation checkable — a consumer either handles the undefined case or does not compile.

**This bounds which documents a dynamic kind can create.** A unit-declared kind can only produce
documents about that unit or narrower, because rule 2 requires the `unit` association and the
curriculum axis is a nesting rooted at the unit — every position at or below it carries one. It cannot
produce documents with no curriculum position at all, like personal documents and learning logs.
Making *those* presets authorable is a reasonable future goal, but it is not just a matter of adding
entries to a unit config: it needs a configuration source loaded independently of the current unit
(class- or site-level), so that a definition is present wherever its documents are, along with an
association on the document naming that source. Until such a source exists, personal-like presets stay
static.

**How a kind sets that today.** A kind declares only `containerType`, and `getDocumentLocationFields`
derives both the container and curriculum axes' fields from it, so a document's curriculum position
currently follows from its container: `class` yields no unit, `classUnit` the unit, `offering` the
problem. The bound is stated on `curriculum` because that is what rule 2 constrains, and it survives
the coupling being broken — a kind declaring a class container *and* a unit curriculum would stamp
`unit` and satisfy rule 2, which a container-based bound would wrongly forbid.

## Axis profiles — naming a combination of axis values

The axes describe a document one question at a time, but people do not talk that way. Nobody says "a
unit-level, class-owned, canonical, concurrent document" — they say **a class-wide document**. That
shorthand is not sloppiness; it names a real thing, a *combination* of positions that documents are
actually created at. This section gives that thing a name: an **axis profile**.

A profile is a named bundle of axis values. `classWide` is one. So are the two the code has always had
without naming them — the bundle shared by personal documents, learning logs, and their publications, and
the bundle shared by problem, planning, and problem-like publications. They live in
`src/models/document/document-axis-profiles.ts`, which is therefore the complete list of axis combinations
the application supports.

**A profile is not a `kind`.** Many kinds share one: what makes a learning log different from a personal
document is presentation and its creation recipe, not any axis. `kind` says which preset a document came
from; its profile says where that preset put it on the axes.

**Profiles are what keep `kind` open-ended without the axes being.** A unit config declares kinds, but it
declares no axis values — every kind is registered against a profile written in code. So a configuration
can add a document to an existing combination and cannot invent one, and the set of combinations stays
reviewable in one file rather than growing with the units.

**A profile is recorded, not resolved.** Each document stores the name of the profile it was created from,
in `axisProfile`. That exists for one reason: a migration that changes what a profile means has to find
every document created from it, and selecting those by their axis values would mean querying the very
fields the migration is there to change — a query that has to be rewritten every time the answer moves.
Because it is provenance rather than a cache, it stays true after such a migration: it says which profile
the document was made from, not what its axes hold now.

**Nothing in the running application reads it.** The field is deliberately absent from `IDocumentMetadata`,
`DocumentMetadataModel`, and `DocumentModel`, so it is not reachable from the app at all — reading it would
require widening a type first. That keeps the axes the only way to ask how a document behaves, which is the
point of this whole folder: `hasClassOwner(doc)` and the guards beside it stay the way behavior is decided,
and the profile name stays a record for migrations and offline analysis.

### `permissions` — who may do what

**What it is.** The permission set: who may `read`, `write`, `publish`, `copy`, and whether the content
is `frozen` (no writer at all). It is *composed* — the shared defaults come from a **permission policy**
(selected by `kind` at creation and then referenced by the document), and only the parts that genuinely
vary per document are stored (the share toggle, a support's audience, an exemplar's per-student visibility).

**In today's behavior.** `permissions` is the busiest axis, and its behavior is spread across the most
features:
- The **four-up share toggle** on a problem document is a `permissions` change — flipping a class/group
  read grant on and off (the stored `visibility` field).
- A **publication** is a frozen snapshot with a widened read grant (the class can read; nobody can
  write; the owner may unpublish).
- A **group** document grants read and write to every group member.
- A **multi-class support** grants read to a structured target audience across classes.
- An **exemplar** grants read per student.

Several of those audiences are named elsewhere: "the class can read" resolves through the document's
`container`, and "group members can read/write" through its `owner`. `permissions` supplies the *verbs*
(read / write / publish / copy) and the per-document toggles; the other axes supply *which* class or group
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

| kind (`type`) | owner | container | curriculum | canonical | concurrent | permissions (shorthand) |
|---|---|---|---|---|---|---|
| `problem` | student/teacher | offering | problem | yes (by convention) | no | owner + teacher read; group-read when shared |
| `planning` | teacher | offering | problem | yes (by convention) | no | owner + teacher read |
| `personal` | student/teacher | class | none | no (collection) | no | owner + teacher read; class-read when public |
| `learningLog` | student/teacher | class | none | no (collection) | no | owner + teacher read; class-read when public |
| `group` | the group | offering | problem | yes (pointer) | **yes** | all group members read/write |
| class-wide collaborative | the class | classUnit | unit | yes (pointer) | **yes** | all class members read/write |
| `problem` publication | publisher (retained) | offering | problem | no, versioned | no | class read; frozen |
| `personal`/`learningLog` publication | publisher (retained) | class | none | no, versioned | no | class read; frozen |
| `support` (multi-class) | teacher (retained) | multi-class / offering | problem | no | no | target audience read; frozen |
| `exemplar` | synthetic author | none until commented on | problem | no | no | per-student read |

Reading the table the new way: a "group document" is not a special *kind of thing* — it is simply the
document that happens to be *group-owned, kept by an assignment, about that problem, canonical,
concurrent, and group-read/write*. Any other document that took those same axis values would behave
the same way. The class-wide collaborative document is the demonstration: it differs from a group
document on `owner`, `container`, and `curriculum` alone, and behaves accordingly. That is the shift this
folder is built around.

## Relationship to the other docs here

- [target-architecture.md](./target-architecture.md) — how the axes will live in code: getters on
  `DocumentModel`, the `kind` registry, behavior modules, and the one creation factory that turns
  `kind` into axis values.
- [README.md](./README.md) — the roadmap and status of making each axis explicit.
