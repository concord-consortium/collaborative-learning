import { types, IJsonPatch, applyPatch, resolvePath, getSnapshot, getParentOfType } from "mobx-state-tree";
import { nanoid } from "nanoid";
import { DEBUG_DOCUMENT } from "../../lib/debug";
import { DocumentContentModel, DocumentContentModelType } from "../document/document-content";
import { SharedModelType } from "../tools/shared-model";
import { ToolTileModelType } from "../tools/tool-tile";
import { ContainerAPI } from "./container-api";

if (DEBUG_DOCUMENT) {
  (window as any).getSnapshot = getSnapshot;
}

export const Tree = types.model("Tree", {
})
.volatile(self => ({
  applyingContainerPatches: false,
  containerAPI: undefined as ContainerAPI | undefined
}))
.views(self => ({
  get treeId(): string {
    throw new Error("Trees need to provide a treeId property");
  }
}))
.actions(self => ({
  updateTreeAfterSharedModelChanges(options?: {sharedModel: SharedModelType}) {
    // If there is no sharedModel run the update function on all tiles which
    // have shared model references
    // If there is a sharedModel only run the update function on tiles which
    // have this shared model.
    //
    // Find the parent document of the model
    // If there isn't a sharedModel we can't find the document so I think
    // this has to be required or we need an optional document???

    // We can probably optimize this by using a MSTView to cache the tiles
    // here. But I don't remember how it handles parameter values
    const tiles: Array<ToolTileModelType> = [];
    let sharedModel: SharedModelType | undefined;
    if (options) {
      sharedModel = options.sharedModel;
      const document = getParentOfType(options.sharedModel, DocumentContentModel);
      const sharedModelEntry = document.sharedModelMap.get(options.sharedModel.id);
      if (!sharedModelEntry) {
        console.warn(`no shared model entry for shared model: ${options.sharedModel.id}`);
      } else {
        tiles.push(...sharedModelEntry.tiles);
      }
    } else {
      const document = (self as any).content as DocumentContentModelType ;

      // If we don't have a document let the exception happen so we
      // can track this down

      // Only include tiles that have at least one shared model
      document.sharedModelMap.forEach(sharedModelEntry => {
        sharedModelEntry.tiles.forEach(tile => {
          if (!tiles.includes(tile)) {
            tiles.push(tile);
          }
        });
      });
    }
        
    // Run update function on the tiles
    for(const tile of tiles) {      
      tile.content.updateAfterSharedModelChanges(sharedModel);
    }
  }
}))
.actions(self => {
    const updateTreeAfterSharedModelChangesInternal = (historyEntryId: string, exchangeId: string, 
      sharedModel: SharedModelType) => {
        // If we are applying container patches, then we ignore any sync actions
        // otherwise the user might make a change such as changing the name of a
        // node while the patches are applied. When they do this the patch for 
        // the shared model might have been applied first, and which if sync is
        // enabled could create a new node in the diagram. Then the patch for the 
        // diagram is applied which also creates a new node in the diagram. 
        // Even if we just disable the sync when the shared model update is done
        // from the patch, if the user makes a change, this would be a separate
        // action would would trigger the sync. So if the user made this change
        // at just the right time it would could result in duplicate nodes in the 
        // diagram.
        if (self.applyingContainerPatches) {
            return;
        }

        // The TreeMonitor middleware should pickup the historyEntryId and
        // exchangeId parameters automatically. And then when it sends any
        // changes captured during the update, it should include these ids
        self.updateTreeAfterSharedModelChanges({sharedModel});
    };
    
    return {
        updateTreeAfterSharedModelChangesInternal
    };
})
.actions(self => {
  return {
    //
    // Special actions called by the framework. These define the Tree API 
    // which are shared by tiles and and shared models
    //

    // This will be called by the container when a shared model tree changes
    // That would normally happen when a tile changed the shared model.
    applySharedModelSnapshotFromContainer(historyEntryId: string, exchangeId: string, snapshot: any) {
      throw new Error("not implemented yet");
    },

    // The container calls this before it calls applyContainerPatches
    startApplyingContainerPatches(historyEntryId: string, exchangeId: string) {
      self.applyingContainerPatches = true;

      // We return a promise because the API is async
      // The action itself doesn't do anything asynchronous though
      // so it isn't necessary to use a flow
      return Promise.resolve();
    },

    // This is defined as an action so it is clear that is part of the API
    // also by giving it an action name the undo recorder can identify that
    // this action by its name and not record the undo as an undo
    // It might be called multiple times after startApplyingContainerPatches
    applyContainerPatches(historyEntryId: string, exchangeId: string, patchesToApply: readonly IJsonPatch[]) {
      applyPatch(self, patchesToApply);
      // We return a promise because the API is async
      // The action itself doesn't do anything asynchronous though
      // so it isn't necessary to use a flow
      return Promise.resolve();
    },

    // The container calls this after all patches have been applied
    finishApplyingContainerPatches(historyEntryId: string, exchangeId: string) {
      self.applyingContainerPatches = false;

      // TODO: Need to deal with possible effects on the undo stack
      //
      // If all of the patches applied correctly and the user didn't inject any
      // changes while the patches were applying, then everything should be
      // fine. There should be nothing to updated by
      // updateTreeAfterSharedModelChanges
      //
      // However, if the user made a change in the shared model like deleting a
      // node while the patches were being applied this would make the shared
      // model be out of sync with the tree. The tree would not be updated
      // before now because applyingContainerPatches is true. So that deleted
      // node change would get applied here. When it is applied it would
      // generate a new undoable action that is not grouped with the action that
      // deleted the node from the shared model. So now if the user undoes, the
      // actions will not get undone together. This will probably result in a
      // broken UI for the user. 
      //
      // We could record the action id of any actions that happen while the
      // patches are being applied. It is possible that multiple actions could
      // happen. Because we aren't running the updateTreeAfterSharedModelChanges
      // after each of these actions, we wouldn't be able to tell what tree
      // updates are associated with which of the multiple actions. 
      //
      // I think the best thing to do is:
      // - merge any actions that happened during the patch application into a
      //   single action. So basically combine their patches.
      // - use the id of that combined action for any changes the
      //   updateTreeAfterSharedModelChanges causes here.
      //
      // If there were no injected or intermediate actions, but for some reason
      // this update function does make changes in the tree, what should we do?  
      // We should at least log this issue to the console, so we can try to
      // track down what happened. One likely reason is a broken implementation
      // of the updateTreeAfterSharedModelChanges. And that will be likely to
      // happen during development.
      self.updateTreeAfterSharedModelChanges();

      // We return a promise because the API is async
      // The action itself doesn't do anything asynchronous though
      // so it isn't necessary to use a flow
      return Promise.resolve();
    },
  };
  
})
.actions(self => {
  // FIXME: need figure out how to handle the async part here
  // Being an action we should use a flow
  //
  // FIXME: we probably need to make sure we ignore this action in the tree
  // monitor middleware. Or perhaps we can simplify some of the logic now that
  // this is actually an action.
  return {
    async handleSharedModelChanges(historyEntryId: string, exchangeId: string, 
      call: any, sharedModelPath: string) {
        
      const model = resolvePath(self, sharedModelPath);

      // Note: the environment of the call will be undefined because the undoRecorder cleared 
      // it out before it calling this function
      // FIXME: add a DEBUG_ flag here to only log this when that is enabled
      console.log(`observed changes in sharedModel: ${model.id} of tree: ${self.treeId}`, 
        {historyEntryId, action: call});

      // What is tricky is that this is being called when the snapshot is applied by the
      // sharedModel syncing code "sendSnapshotToSharedModel". In that case we want to do
      // the internal shared model sync, but we don't want to resend the snapshot to the 
      // shared model. So the current approach is to look for the specific action that
      // is applying this snapshot to the tile tree. 
      if (call.name !== "applySharedModelSnapshotFromContainer") {

        // TODO: figure out if we should be recording this special action in the undo
        // stack
        const snapshot = getSnapshot(model); 
        
        // TODO: we use the exchangeId from the original exchange here so we need to
        // wait for the container to confirm this updateSharedModel call before
        // we can continue. Otherwise the container might receive the final
        // addTreePatchRecord before it gets any shared model updates. Currently
        // updateSharedModel waits for all of the dependent trees to update
        // their shared models before returning, so this might cause a long
        // delay.  
        //
        // We could start a new exchange with the container and just wait for
        // that, and then call updateSharedModel with the exchangeId for this
        // new exchange.
        //
        // Or we could add a new option to updateSharedModel so in some cases it
        // waits for all of the dependent trees to be updated and in other cases
        // it just waits for the container to confirm it received the request.
        //
        // It might also be possible we can change the async flow of applying
        // history events so it isn't necessary for the trees to wait for the
        // shared model to be fully updated. So then this updateSharedModel call
        // can just wait for a confirmation in all cases.
        //
        // - Q: Why is the exchangeId passed to updateSharedModel
        // - A: It isn't really needed but it is useful for debugging.
        //   updateSharedModel makes a new exchangeId for each tree that it
        //   sends the shared model to. It doesn't do anything with the passed
        //   in exchangeId.
        //
        // Note that the TreeMonitor takes care of closing the exchangeId used
        // here. This same exchangeId is passed to all the shared model
        // callbacks and then they are all waited for, and finally the
        // exchange is closed. 
        //
        await self.containerAPI?.updateSharedModel(historyEntryId, exchangeId, self.treeId, snapshot);
      }

      // let the tile update its model based on the updates that
      // were just applied to the shared model
      //
      // TODO: an inefficiency  with this approach is that we
      // treating all changes within the sharedModelPath the same.
      // If the change is a simple property change in the shared
      // model view that isn't used by
      // updateTreeAfterSharedModelChanges, we do not need to
      // re-run updateTreeAfterSharedModelChanges. When we used
      // the autorun approach this was optimized so the function
      // would only run when the needed parts of the tree changed.
      //
      // We do need to send the shared model snapshot to the
      // container whenever there are any changes to the tree so
      // the code above is fine. 
      //
      // There might be a way to use the mobx internals so we can
      // track what updateTreeAfterSharedModelChanges is using and
      // only run it when one of those things have changed. 
      //
      // NOTE: We are calling an action from a middleware that
      // just finished a different action. Doing this starts a new
      // top level action: an action with no parent actions. This
      // is what we want so we can record any changes made to the
      // tree as part of the undo entry. I don't know if calling
      // an action from a middleware is an officially supported or
      // tested approach. It would probably be safer to run this
      // in a setTimeout callback. 
      //
      // This should not cause a loop because the implementation
      // of updateTreeAfterSharedModelChanges should not modify
      // the shared model view that triggered this handler in the
      // first place. However a developer might make a mistake. So
      // it would be useful if we could identify the looping and
      // notify them.
      //
      // The container needs to track when a history entry is
      // complete. Since this update call can be async the
      // container needs to know to wait for it to finish. Before
      // callback is called we should not have called
      // addTreePatches for the passed in exchangeId. But
      // addTreePatches will be called immediately after this
      // callback is resolved. So we start a new history entry
      // exchange and make sure that start request has been seen by
      // the container before returning/resolving from this shared
      // model callback. 
      //
      // - Q: Do we really want to make a new exchangeId here? 
      // - A: When this callback is triggered by the container
      //   when it calls applySharedModelSnapshot, a exchangeId is
      //   passed in which we need to close out anyway so we could
      //   just use that here. So in that case we don't really
      //   need to make a new exchangeId. But it is also possible this
      //   callback will be triggered by a user action. In that
      //   case multiple shared models might be modified by the
      //   same action which would then result in multiple
      //   updateTreeAfterSharedModelChangesInternal calls which
      //   would probably result in multiple addTreePatchRecord
      //   calls for the same exchangeId. Also because
      //   updateTreeAfterSharedModelChangesInternal is
      //   asynchronous it is better if we don't wait for it, if
      //   we can avoid it, so the new exchangeId allows us to wrap up
      //   the recordAction of TreeMonitor sooner.
      // - Q: This is happening in a middleware will all of this
      //   await stuff work?
      // - A: Yes this callback is called from recordAction which
      //   is asynchronous itself. The recordAction function
      //   will store a reference to all of the objects it needs
      //   so it can run after the middleware has continued on
      //   handling other actions. 
      // - Q: What is the passed in exchangeId for?
      // - A: It isn't necessary, but it can be a useful
      //   piece of information to help with debugging.
      // - Q: Will there be more than one addTreePatchRecord call
      //   if more than one shared model is updated a user action?
      // - A: Yes each of these shared model updates will kick of
      //   a new top level action when
      //   updateTreeAfterSharedModelChangesInternal is called. It
      //   would be better if we could streamline this.
      //
      const updateTreeExchangeId = nanoid();
      await self.containerAPI?.startExchange(historyEntryId, updateTreeExchangeId);

      // This should always result in a addTreePatchRecord being
      // called even if there are no changes.
      //
      // This is because it will be a top level action, so the
      // TreeMonitor will record it, and when the action is
      // finished the TreeMonitor's recordAction function will
      // call addTreePatchRecord even if there are no changes. 
      //
      // FIXME: if this action is changed to a flow then this 
      // updateTreeAfterSharedModelChangesInternal will not be the top
      // level action itself. Instead handleSharedModelChanges will be the
      // top level action.
      self.updateTreeAfterSharedModelChangesInternal(historyEntryId, updateTreeExchangeId, model);
    }
  };
});
