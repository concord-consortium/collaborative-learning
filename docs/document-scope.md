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

The approach of `getDocumentContentFromNode` means we can't use type "inheritance" to provide stripped down models which provide the necessary features. It would be possible to provide a mock model which has the name of DocumentContent to work around this, but that seems fragile.

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
