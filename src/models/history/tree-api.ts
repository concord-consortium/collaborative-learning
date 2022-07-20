import { IJsonPatch } from "mobx-state-tree";

/**
 * This is the API for a Tree in the system.
 *
 * It would typically be implemented by a MST model that defines actions for
 * each of the functions below.
 *
 * Each action should return a promise that resolves when the action is complete
 * this is necessary to support trees running in iframes or workers. The
 * function comment should define what "complete" means for each action.
 */

export interface TreeAPI {
    /**
     * This is called when the container is doing an undo or redo or is loading
     * the initial document into all of the trees. The tree should use this
     * action to disable any updating it does when it receives changes in the
     * shared models it is using.
     *
     * @param historyEntryId the id of the history entry that will record all of
     * these changes to the tree. This is *not* the historyEntryId that is the
     * source of the patches. It is is passed back to the container when this
     * action is complete. In the CLUE implementation, this is done by the 
     * tree-monitor not by the action itself.
     *
     * @param callId the id of this XXXX. It is is passed back to the container when this
     * action is complete. In the CLUE implementation, this is done by the 
     * tree-monitor not by the action itself.
     * 
     * @returns a promise that should resolve when the tree is ready to receive
     * patches from the container and changes in the shared models.
     *
     * The `Tree` model implements this for you.
     * 
     * FIXME: The historyEntryId and callId are not currently used by the DocumentStore 
     * or UndoStore when they call startApplyContainerPatches. They use promises 
     * to wait for the tree to finish with this. However, to support trees in other 
     * iframes it will be necessary to identify the call to startApplyContainerPatches
     * so the container can wait for the response. I wanted to change the name of 
     * callId to patchRecordId, but that doesn't make sense in this case. We aren't 
     * starting a patch, we just need to identify the response to this request.
     */
    startApplyingContainerPatches(historyEntryId: string, callId: string): Promise<void>;

    /**
     * This is called when the container is doing an undo/redo or is loading the
     * initial document into all of the trees. This will include the patches
     * that the tree sent to the container with addHistoryEntry and
     * addTreePatchRecord. If the tree did this right, it should only include
     * patches that are modifying the tree's state, it shouldn't include patches
     * that are for the shared models that are owned by a different tree.
     *
     * @param historyEntryId the id of the history entry that will record all of
     * these changes to the tree. This is *not* the historyEntryId that is the
     * source of the patches. This historyEntryId needs to be passed back when
     * the tree records this change back to the container with
     * addTreePatchRecord.
     *
     * @param callId the container uses this id to identify this specific set of
     * patches. This callId needs to be passed back when the tree records this
     * change back to the container with addTreePatchRecord.
     *
     * @param patchesToApply an array of JSON patches to be applied to the
     * tree. It will be called after startApplyingContainerPatches. The
     * patches should be applied in order starting from the first in the array.
     */
    applyContainerPatches(historyEntryId: string, callId: string, patchesToApply: readonly IJsonPatch[]): Promise<void>;

    /**
     * This is called after the container has applied all of the patches.
     * Before this is called by the container, all trees modified by the patches
     * will have confirmed they have received the patches. And all shared models
     * modified by the patches will have confirmed that trees using them have
     * received the updated shared model.
     *
     * When the tree receives this it should re-enable its process of updating
     * the tile state when its shared models change.
     * The `Tree` model implements this for you.
     * 
     * @param historyEntryId the id of the history entry that will record all of
     * these changes to the tree. This is *not* the historyEntryId that is the
     * source of the patches. 
     * 
     * @param callId an id created by the container before this call. It should
     * be passed back to the container with addTreePatchRecord after the tree
     * has handled this call. 
     * 
     */
    finishApplyingContainerPatches(historyEntryId: string, callId: string): Promise<void>;

    /**
     * TODO: need to bring over updated documentation from prototype 
     */
    applySharedModelSnapshotFromContainer(historyEntryId: string, callId: string, snapshot: any): Promise<void>;
}
