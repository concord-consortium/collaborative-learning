# Shared Models
Tiles can share state through "shared models".

## Shared Model Type
A shared model is a MobX State Tree (MST) object. Its type should "extend" the `SharedModel` type. The shared model should have an `id` and a `type` field. The `id` field is provided by the generic `SharedModel` type. The `type` field should be overridden to be a string literal that is unique. The name of shared model is a good string to use for the type field. So for example if the shared model is defined with `SharedVariables = SharedModel.named("SharedVariables")` then its type field should be `"SharedVariables"`.

## sharedModelManager
Tiles that want to use shared models should access them through their content model. A tile's content model can access the `sharedModelManager` with `self.tileEnv?.sharedModelManager`.

The tile can use this manager to:
- look for an existing shared model at the document level: `findFirstSharedModelByType`.
- see which shared models have already been linked to this tile: `getTileSharedModels`
- link a new shared model with the tile: `addTileSharedModel`
- remove a link to a shared model: `removeTileSharedModel`

The API of the sharedModelManager is described by [ISharedModelManager](../src/models/tools/shared-model.ts#L87)

## Pattern for use by a Tile
1. a tile's content model should use a MobX `reaction` created in `afterAttach` to watch several things using the reaction's `data` function:

    1. the sharedModelManager to be in the environment
    2. shared models in the container/document which are of the right type: `findFirstSharedModelByType`
    3. the list of shared models linked to this tile `getTileSharedModels`
2. The reaction's `effect` function should then:
    1. make sure the sharedModelManager is ready
    2. check if there is a container shared model and it is linked to the tile, if so skip steps 3 and 4.
    3. if there is no container shared model create one
    4. link this container shared model to the tile, this will also add it to the container if it wasn't already there.
    5. Do any setup tasks needed with the shared model.

This logic is put in a MobX reaction so that it will be automatically re-run when the environment or available shared models changes. When the tile is first created and attached, it is not part of the document yet, so its environment will not have the sharedModelManager.

The pattern above is followed by `diagram-content.ts`.  The variables text tool plugin also uses a shared model, but in that case it doesn't create the shared model if it doesn't exist. So the variables text tool plugin doesn't use a reaction as described above.

The design also supports tiles that need to work with multiple shared models. In this case the tile should additionally store a reference to the shared models in its own content. The tile can use its own content to organize these references and to know which one is which. If a tile does this, it still needs to 'link' each shared model with itself using the `sharedModelManager.addTileSharedModel`.  If this link is not made the updating code described next will not work.

## Updating pattern
When the shared model changes, any tiles that are linked to it will have their `updateAfterSharedModelChanges(sharedModel?: SharedModelType)` action called.
The tile should use this action to update any of its own state that references the shared model. For example if it has a list of items each referring to an item in the shared model, this is the point where the tile should update its own list. Perhaps it would delete any of its own items that are referring to a shared model item that doesn't exist, and add new items for new shared model items.

The tile should not use a MobX autorun or reaction to monitor changes in the shared model itself. In the future when we support undo/redo and time travel it will be important for the container to disable this updating and then re-enable it again. If the tile handles its own monitoring the container won't be able to disable it.

Implementation: The update monitoring is managed in `SharedModelDocumentManager` using an `autorun` which is monitoring the list of shared models on the document. If a new shared model is added this shared model will get an `onSnapshot` listener added to it. The `onSnapshot` listener for each shared model is what calls the `updateAfterSharedModelChanges` on the tiles. This approach could be made more efficient but it is likely to be replaced anyway when we add undo/redo and time-travel with a real MST middleware.

## Document Data Model

*This is an implementation description which a tile developer shouldn't need to worry about.*

The shared models are stored/contained at the document level in a `sharedModelMap` field.

The document level `sharedModelMap` is a map of shared model ids to `SharedModelEntry` objects. Each `SharedModelEntry` has a shared model and an array of tiles that are using this shared model. This relationship between shared models and tiles is called a shared model link in other places in the documentation.

Note: one reason for the `SharedModelEntry` indirection is due to the behavior of MST. Using `types.map(types.late(...))` does not work in MST. The late type is evaluated immediately in this case. Putting an object in between was the best approach I could find to deal with this. So now it is `types.map(types.model({sharedModel: types.late(...)}))`. This is similar to how tiles are handled because they have the `TileModel` between them and the document.

## Simplify afterAttach usage

- geometry: `{ sharedModelManager, sharedDataSets, links: self.links }`
- table: `{ sharedModelManager, sharedDataSet, tileSharedModels }`
- data-card: `{ sharedModelManager, sharedDataSet, tileSharedModels }`
- data-flow: `{ sharedModelManager, sharedDataSet, firstDocumentVariableSharedModel, tileSharedModels }`
- diagram: `{sharedModelManager, firstDocumentVariableSharedModel, tileSharedModels}`
- graph: `{ sharedModelManagerReady, data }` in this PR
- simulator: `{sharedModelManager, firstDocumentVariableSharedModel, tileSharedModels}`

An interesting note is that we are using the "default" built in comparer: https://mobx.js.org/computeds.html#built-in-comparers so the lists of dependencies I provided above are not actually right. In all of these reactions we are re-creating the "value" object, so this new object will be different every time.  Therefore any change to a MobX observable accessed in the value function will cause the reaction to run again.

The problem with a generic utility in the tileModel which calls a "hook" in the content model is that this "hook" needs to be triggered by different things in the different tiles.

In some cases the hook could be triggered just when the tile's sharedModel references changes. This would take care of the tiles that need: `{ sharedModelManager, sharedDataSet, tileSharedModels }`

On other cases the code needs to know when the document's sharedModel references have changed this is needed for the ones with firstDocumentVariableSharedModel.

We could add generic hooks for tileSharedModel changes and documentSharedModel changes. But these would potentially fire more often than is necessary. Another possible option would be to treat this like a component render function. So basically it would be an autorun which would just make sure the sharedModelManager was ready before calling it, and it would automatically setup the disposer. So the question with that is approach is what is wrong with using an autorun instead of a reaction. Are there things our current code is doing in the reaction that we don't want to trigger updates...

- geometry: it seems an autorun would be the same as the current reaction
- table:
  - the reading of `self.importedDataSet.isEmpty` would trigger 're-runs' if an applied snapshot changed this value. For example someone is watching an old document and some other tile changes in the document. I think this "read only" view would have actually changed the local importedDataSet, so the update would reset it back to what it was originally. And then the and dataset would get modified again. This might work fine, but could be annoying.
  - the reading of `self.dataSet.attributes.length` would trigger 're-runs' along with the attr.id, attr.formula, and attr.canonical. These kinds of re-runs actually seem like a good thing with no downsides.
  - the reading of `model?.computedTile` when the table doesn't have a dataset, means a change to the computedTile will trigger a re-run once. This seems OK.
  - `updateSharedDataSetColors` will start monitoring parts of each shared dataset model. This access means any change to any shared model in the document will trigger this. **FIXME** this code will be broken in an autorun. The color map is global so lots of tiles across many documents will be updating this tile map whenever any document's shared models changes. I think the fix is to move this color code into something that runs at the document level. The colorMap can be put in the documents volatile storage. However since the document doesn't know about about datasets this would have to be a new feature of registered shared models so they'd have access to document level storage, and have callback that can be used to setup this document level autorun. To hack around this temporarily we could use `untracked`.
- data-card: this is fine except that calls `updateSharedDataSetColors` so the above comment applies.
- dataflow: this is fine except that calls `updateSharedDataSetColors` so the above comment applies.
- diagram: this should be the same as the reaction.
- graph: this is different than other tiles, but from what I can tell an autorun should be fine here. The autorun will be retriggered if the `self.config.dataset` or `self.metadata` changes. But it seems like neither of those should cause any problems.
- simulator: checks `self.simulationData.variables` and `containerSharedModel.variables`. The simulationData.variables will only change if the simulation is modified after the tile is created. The variables could change if a diagram, text, or drawing tile is added to the page and the user adds a new variable. So in an autorun if the user deletes or renames an expected variable a new one will get recreated. This seems like the right thing to do.


Note: these reactions can trigger during the replaying of history or undo/redo. They will cause additional history events because they aren't called by another action. This is another good reason to make them be a special hook method where we can control the autorun ourselves. In other words we could disable the autorun during undo/redo and history replaying. However it would then be tricky to figure out if we should then call it again. It might be possible to use the `scheduler` option, to delay the running.

Note2: we can use the MobX `untracked` utility for the parts of the code that we don't want to cause updates.

Note3: what about the updateAfterSharedModelChanges? If we use an autorun for this new function could we unify these two calls to keep everything simple???

Like a new method called `syncWithSharedModels`. However I'd note that this would have to be a volatile function so it doesn't become untracked when we call it.

To do this we need a way to pause the autorun. Ideally we or MobX would be tracking the dependencies as the state was changed, and then after all of the changes are done then it would actually run the function. If we can't do this, then we could have an observable value that indicates we are in the middle of a replay. If we are then the `sync` function would not be called. When we finish the `replay` this value would change and now all of the sync functions would get called. Each approach is inefficient in different ways:
- if we "pause" the reactions MobX will likely still track all of the changes, so when we unpause them MobX would then replay all of the reactions.
- if we have a `isReplaying` shortcut, then all of the sync functions for every tile in the document will get re-run when it is changed to false again.

**This is what I would recommend at this point**
It might be possible to have an untracked `isReplaying` which causes a bailout. Because it is untracked the reaction would not get re-run when its value is changed. But then we'd still need to track the dependencies that are changed so we can re-run the correct ones. If what we could do is keep track of each of the `sync` functions which would have been called based on their dependencies as the events are replaying. This could be part of the `isReplaying` bailout: it would record that the sync function needs to be called again, and it would also bailout. Now how to we trigger the autorun to run again at the end of the replay? We could have some observable `tileReplaySyncCount` which is read by the autorun. And then we increment it after the replay is over, which will trigger the reaction to run again. Alternatively the `isReplaying` bailout could mark this is needing to reSync, and then dispose of the reaction. Then after the update is finished we recreate all of the autoruns which were disposed. This disposal of the autorun might be the best approach.

Something to check with this approach:
Some of these reactions update the shared model, will it be OK with the design that this happens? The reason for the `updateAfterSharedModelChanges` was to make it possible for tiles to run in iframes and work with shared models, and for undo/redo to be supported in this iframe setup. If a tile updates the shared model in this function it could cause an infinite loop. However I think this was the case before too, so really we should just check the design notes which are in comments in the code to make sure these kinds of loops have been at least considered.

The best next step for this kind of refactoring would be to clean up `updateSharedDataSetColors` this seems to be broken and also would cause problems with the autorun approach.

Note4: to be able to refactor this safely it would be best if we had tests that covered the cases we care about at a semi high level. We do have some.  For example:
- when a tile is unlinked from a shared model that the `updateAfterSharedModelChanges` or `syncWithSharedModels` is called.
- when a tile is linked to a shared model `updateAfterSharedModelChanges` or `syncWithSharedModels` is called.
- when an action which adds a tile which automatically creates a shared model, that this doesn't record two entries in the history and undo stack.
- when a set of history entries are replayed which adds a tile which automatically creates a shared model, that this doesn't create an extra shared model: once for the initial create and a second time for a separately recorded action

