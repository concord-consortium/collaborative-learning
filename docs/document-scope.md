# Access document scope

CLUE tiles often need to access stuff at the document level to get their job done.

Sometimes the code needing access is in the view layer (components and hooks) and sometimes it is in the model layer. The view layer has access to the models, but not vice versa, so anything described below about the model layer could be used by the views.

Because the view can use the model layer mechanisms, code that is based on the model layer mechanisms can be used in more places.

# Model layer

## Traversing the tree
Models can go up the MST tree to find the document or other parent and then use its views or actions or services.

### Cases
- `getDocumentContentFromNode` this looks explicitly at the string type of each parent node instead of using the MST "class" itself.
- `getDocumentIdentifier` looks at the two kinds of parents of DocumentContent to construct an identifier.
- `getTileModel` looks at the parent of of a tile content model to get the tile model

### Benefits
This is really simple to use. The calling code has full access to all of the properties, views, and actions of the parent. So new interface don't need to be created or modified, the calling code can just get what it needs.

### Downsides
This can make the code harder to test. A MST tree has to be created to test the model that is using it. If types are used to find the parent, a tree with those types has to be made, which can require lots of extra intermediate nodes.

The approach of `getDocumentContentFromNode` means we can't use type "inheritance" to provide stripped down models which provide the necessary features. It would be possible to provide a mock model which has the name of `"DocumentContent"`` to work around this, but that seems fragile.

There is also issue of children having explicit knowledge of their parents which can cause import cycles. In most cases CLUE doesn't have this import cycle because the document doesn't have explicit knowledge of its tiles. The tiles register themselves with the system.

## MST Environment
Models have access to the MST environment of their root node. In CLUE this environment includes:
- `sharedModelManager`
- `appConfig`

I'll call these "services".

The environment object of a MST tree has to be provided when the root of the tree is created and this object instance can't be changed. This object is not observable. And according to the docs the top level properties of this object should not be modified. I think this is because MST does try to merge environments when a node with an environment is added to another tree. However nested environments are not supported like React supports nested context's.

### Cases
- `getSharedModelManager`
- `getAppConfig`

### Benefits
Any MST tree can have an environment that provides the necessary services.

### Downsides
The construction of this environment is kind of awkward because it often requires a circular reference. In many cases the services need access to the tree itself. So the tree refers to the service and the service refers to the tree.

So the environment service has to be created, then the root node created with the environment service, and finally the root node needs to set back on the environment service. See `createDocumentModel` for an example of this.

The top level properties of the environment object are not supposed to be modified after it is created, based on this "shallowly immutable" note here: https://mobx-state-tree.js.org/concepts/dependency-injection
However we are doing this when the appConfig is added to the environment object in `Documents#add`

## Reading a document's scope in code

Consumers that need to know a document's scope read its stored association fields through the guards
in `src/models/document/document-scope.ts`, rather than branching on the document `type`.

### Two dimensions, and a reference that crosses them

Scope is not one ordered level. It is two, each its own linear nesting, and every document sits
somewhere on both:

| dimension | levels (widest → narrowest) | read from |
|---|---|---|
| **curriculum scope** | unit → investigation → problem | `unit`, `investigation`, `problem` |
| **owner scope** | class → group → user | `groupId`; the class and user levels live in `uid` |

This is why there is **no `scopeLevel` enum and no unified `scope` struct** — a single ordered level
cannot express a position on two axes at once. A personal document is user-owned with no curriculum
scope; a class-wide document is class-owned with unit curriculum scope. Neither is "more scoped".

**`offeringId` is on neither dimension — it crosses both.** An offering is the assignment of one
problem to one class, so it is a point in the *product* of the two hierarchies rather than a level in
either. Carrying one pins curriculum scope at problem, but it does not determine owner scope: the
documents inside a single offering are variously user-owned (problem, planning), group-owned (group),
and could be class-owned.

**`context_id` is not a level either** — every document names a class. Being *associated with* a
class is not being *owned by* one; class ownership is a synthetic `class_<classHash>` uid. That is why
these guards name only the level they test and leave the class out of the name.

**Each guard answers about one dimension and reads only that dimension's fields:**

- `hasGroupOwnerScope(doc)` — owner scope: the document belongs to a single group (`groupId` is set).
- `hasUnitCurriculumScope(doc)` — curriculum scope: the document spans a whole unit, narrowed no
  further.

A consumer needing a position on both asks both. Keeping the guards single-dimension is what makes
each one's meaning independent of what the other dimension holds: `hasGroupOwnerScope` does not care
which problem a document belongs to, and `hasUnitCurriculumScope` does not care who owns it.

Where each stored shape sits:

| document | `unit` | `investigation` | `offeringId` | `groupId` | curriculum scope | owner scope |
|---|---|---|---|---|---|---|
| personal, learning log | `null` | — | — | — | none | user |
| problem, planning, publications | set | set | set | — | problem | user |
| group | set | set | set | set | problem | **group** |
| exemplar (from curriculum) | set | set | — | — | problem | user |
| class-wide slot | set | `null` | — | — | **unit** | class |

A guard reads *stored fields only*. It must not consult the kind registry: Sort Work lists documents
from other units, whose kinds are not registered in the current session.

**Two gaps, recorded rather than closed:**

- No guard reads the class or user levels of owner scope, because those live in `uid` — the class
  owner is a synthetic `class_<classHash>`. A consumer wanting "owned by the class" currently
  approximates it with `hasUnitCurriculumScope`, which is correct only while the one class-owned kind
  is also the one unit-scoped kind. `document-group.ts`'s `byName` is commented to that effect and
  should switch when an owner-scope guard exists.
- `offeringId` is written to Firestore at creation but is not declared on `IDocumentMetadata` or
  modelled on `DocumentMetadataModel`, so no read-side consumer can see it. Every document that
  carries one also carries an `investigation`, so nothing is misclassified today, but the field is
  effectively write-only until the `scope` axis's read side surfaces it.

The same module provides `getCurriculumScopeLabel(doc)`, which names a document's position on the
curriculum dimension — `"sas-1.2"` for a problem, `"sas"` for a unit. Titles use it as a stand-in
when a document's real title cannot be resolved.

## Titling a document from another unit

Under the Sort Work "All" filter a class sees every document it owns, including documents from units
it has already worked through — the class hash spans units. Two title-resolution problems follow, and
both are handled by treating a unit-declared title as belonging to its unit:

- A kind declared by a unit that is not loaded has no registered title, and a class-wide document
  stores no title of its own. `getDocumentDisplayTitle` names it from
  `getDocumentKindLabel(kind)` plus the scope label — `"Driving Question Board (other)"`.
- Two units may declare the *same* kind with different wording. `IDocumentKindInfo.unit` records
  which unit's config declared a title, and `getDocumentTitle` returns it only for that unit's
  documents, so a foreign document falls through to the label above rather than borrowing wording
  that may not be its own.

The kind label recovers the kind's identity, not the author's wording: a slot titled "Our Big
Questions" in its own unit reads as "Driving Question Board" from elsewhere. Nothing loads another
unit's config, so its authored title is not available.

# View layer

## React Context

### Cases
- `AddTilesContext` provided by the Canvas component. `DataSetViewButton` uses this add new tiles to the document.
- `TileApiInterfaceContext` provided by the Canvas component. This is used internally for the tileApi mechanism described below
- `DocumentContextReact` provided by `EditableDocumentContent`, `CollapsibleDocumentsSection`, and `DocumentCollectionByType`. This provides basic info about the document (type, key, title, originDoc) and methods for setting and getting properties on the document. This is accessed by `useImageContentUrl`, but it does not seem to actually be using it. It is also accessed by `DataflowProgram` but again doesn't seem to be used.
- `EditableTileApiInterfaceRefContext` provided by the `EditableDocumentContent`. It is a simple React ref object so basically just an object with `current`. The `Canvas` sets this `current` to be the same `tileApiInterface` that is available via the `TileApiInterfaceContext`. I'm not sure why this is. Its existence is checked by the `Toolbar`'s `getUniqueTitle`. I'm not sure what this existence check is for. Its `deleteSelection` function is used by the `Toolbar`'s `handleDelete`.

These next contexts are not at the document level but it seemed good to include them for completeness:
- `TileModelContext` this is provided by the `TileComponent`. Its value is the `TileModel` instance of the tile.
- `AppConfigContext` this is provided by `AppProvider`. Despite its name it does not provide the global appConfig. It just provides the `appIcons` global.

## Common Tile Properties
This is described in `tiles.md`.

All tile content components are passed a standard set of properties. These are typed by `ITileProps` in `tile-component.tsx`. Many of these properties provide document level info. Others are functions the tile content component can call to get information, or modify the document.

## Tile Component API
This is described in `tiles.md`.

Two of the properties passed into the tile content component are `onRegisterTileApi` and `onUnregisterTileApi`. These are used by the component to provide the CLUE framework with a way to interact with the tile.  So really this is the inverse of the focus of this documentation, but it seems good to include for completeness.
