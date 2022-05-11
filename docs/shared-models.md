# Shared Models
Tiles can share state through "shared models". 

## Shared Model Type
A shared model is a MST object. Its type should "extend" the `SharedModel` type. The shared model should have an `id` and a `type` field. The `id` field is provided by the generic `SharedModel` type. The `type` field should be overridden to be a string literal that is unique. The name of shared model is a good string to use for the type field. So for example if the shared model is defined with `SharedVariables = SharedModel.named("SharedVariables")` then its type field should be `"SharedVariables"`.

## sharedModelManager
Tiles that want to use shared models should access them through their content model.  A tile's content model can access the sharedModelManager with `self.tileEnv?.sharedModelManager`. 

The tile can use this manager to:
- look for an existing shared model at the document level: `findFirstSharedModelByType`.
- see which shared models have already been linked to this tile: `getTileSharedModels`
- link a new shared model with the tile: `addTileSharedModel`
- remove a link to a shared model: `removeTileSharedModel`

The API of the sharedModelManager is described by [ISharedModelManager](../src/models/tools/shared-model.ts#L87)

## Pattern for use by a Tile
1. a tile's content model should use an MobX `reaction` created in afterAttach to watch several things using the reaction's data function:

    1. the sharedModelManager to be in the environment
    2. shared models in the container/document which are of the right type: `findFirstSharedModelByType`
    3. the list of shared models linked to this tile `getTileSharedModels`
2. The reaction's effect function should then:
    1. make sure the sharedModelManager is ready
    2. check if there is a container shared model and it is linked to the tile, if so skip steps 3 and 4.
    3. if there is no container shared model create one
    4. link this container shared model to the tile, this will also add it to the container if it wasn't already there. 
    5. Do any setup tasks needed with the shared model.

This logic is put in a MobX reaction so that it will be automatically re-run when the environment or available shared models changes. When the tile is first created and attached, it is not part of the document yet, so its environment will not have the sharedModelManager. 

The pattern above is followed by `diagram-content.ts`.  The variables text tool plugin also uses a shared model, but in that case it doesn't create the shared model if it doesn't exist. So the variables text tool plugin doesn't use a reaction as described above.

The design also supports tiles that need to work with multiple shared models. In this case the tile should additionally store a reference to the shared models in its own content. The tile can use its own content to organize these references and to know which one is which. If a tile does this, it still needs to 'link' each shared model with itself using the `sharedModelManager.addTileSharedModel`.  If this link is not made the updating code described next will not work.

## Updating pattern
When the shared model changes, any tiles that are linked to it, will have their `updateAfterSharedModelChanges(sharedModel?: SharedModelType)` action called.
The tile should use this action to update any of its own state that references the shared model. For example if it has a list of items each referring to an item in the shared model, this is the point where the tile should update its own list. Perhaps it would delete any of its own items that are referring to a shared model item that doesn't exist, and add new items for new shared model items.

The tile should not use a MobX autorun or reaction to monitor changes in the shared model itself. In the future when we support undo/redo and time travel it will be important for the container to disable this updating and then re-enable it again. If the tile handles its own monitoring the container won't have be able to disable it.

Implementation: The update monitoring is managed in `SharedModelDocumentManager` using an `autorun` which is monitoring the list of shared models on the document. If a new shared model is added this shared model will get an onSnapshot listener added to it. The onSnapshot listener for each shared model is what calls the updateAfterSharedModelChanges on the tiles. This approach could be made more efficient but it is likely to be replaced anyway when we add undo/redo and time-travel with a real MST middleware.

## Document Data Model

*This is an implementation description which a tile developer shouldn't need to worry about.*

The shared models are stored/contained at the document level in a sharedModelMap field.

The document level sharedModelMap is a map of shared model ids to SharedModelEntry objects. Each SharedModelEntry has a shared model and an array of tiles that are using this shared model. This relationship between shared models and tiles is called a shared model link in other places in the documentation.

Note: one reason for the SharedModelEntry indirection is due to the behavior of MST. Using `types.map(types.late(...))` does not work in MST. The late type is evaluated immediately in this case. Putting an object in between was the best approach I could find to deal with this. So now it is `types.map(types.model({sharedModel: types.late(...)}))`.  This is similar to how tiles are handled because they have the ToolTileModel between them and the document.

