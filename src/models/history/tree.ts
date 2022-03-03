import { types, IJsonPatch, applyPatch } from "mobx-state-tree";

export const Tree = types.model("Tree", {
    id: types.identifier
})
.volatile(self => ({
    applyingContainerPatches: false,
}))
.actions(self => ({
    // Tiles override this to make sure the tile model is in sync with 
    // the possibly updated shared model
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    updateTreeAfterSharedModelChanges() {        
    }
}))
.actions(self => {
    const updateTreeAfterSharedModelChangesInternal = (historyEntryId: string, callId: string) => {
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

        console.log("updating tree after shared models changes", {tree: self.id, historyEntryId});

        // The TreeMonitor middleware should pickup the historyEntryId and
        // callId parameters automatically. And then when it sends any
        // changes captured during the update, it should include these ids
        self.updateTreeAfterSharedModelChanges();
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
        applySharedModelSnapshotFromContainer(historyEntryId: string, callId: string, snapshot: any) {
            throw new Error("not implemented yet");
        },

        // The container calls this before it calls applyContainerPatches
        startApplyingContainerPatches(historyEntryId: string, callId: string) {
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
        applyContainerPatches(historyEntryId: string, callId: string, patchesToApply: readonly IJsonPatch[]) {
            applyPatch(self, patchesToApply);
            // We return a promise because the API is async
            // The action itself doesn't do anything asynchronous though
            // so it isn't necessary to use a flow
            return Promise.resolve();
        },

        // The container calls this after all patches have been applied
        finishApplyingContainerPatches(historyEntryId: string, callId: string) {
            self.applyingContainerPatches = false;

            // TODO: Need to deal with possible effects on the undo stack
            // 
            // If all of the patches applied correctly and the user didn't inject
            // any changes while the patches were applying, then everything should
            // be fine. There should be nothing updated by with no intermediate changes
            // there should be nothing to updated by updateTreeAfterSharedModelChanges
            // 
            // However, if the user made a change in the shared model like deleting
            // a node while the patches were being applied this would make the 
            // shared model be out of sync with the tree. The tree would not be updated
            // before now because applyingContainerPatches is true. 
            // So that deleted node change would get applied here. 
            // When it is applied it would generate a new undoable action that is not
            // grouped with the action that deleted the node from the shared model.
            // So now if the user undoes, the actions will not get undone together. 
            // This will probably result in a broken UI for the user. 
            // 
            // We could record the action id of any actions that happen
            // while the patches are being applied. It is possible that multiple actions
            // could happen. Because we aren't running the updateTreeAfterSharedModelChanges
            // after each of these actions, we wouldn't be able to tell what tree updates
            // are associated with which if the multiple actions. 
            //
            // I think the best thing to do is:
            // - merge any actions that happened during the patch application into
            //   a single action. So basically combine their patches.
            // - use the id of that combined action for any changes the 
            //   updateTreeAfterSharedModelChanges causes here.
            //
            // If there were no injected or intermediate actions, but for some reason 
            // this update function does make changes in the tree, 
            // what should we do?  
            // We should at least log this issue to the console, so we can try to track
            // down what happened. One likely reason is a broken implementation of the 
            // updateTreeAfterSharedModelChanges. And that will be likely to happen 
            // during development.
            self.updateTreeAfterSharedModelChanges();

            // We return a promise because the API is async
            // The action itself doesn't do anything asynchronous though
            // so it isn't necessary to use a flow
            return Promise.resolve();
        },
    };
    
});
