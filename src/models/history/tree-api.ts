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
     * source of the patches. 
     *
     * @returns a promise that should resolve when the tree is ready to receive
     * patches from the container and changes in the shared models.
     *
     * The `Tree` model implements this for you.
     */
    startApplyingContainerPatches(historyEntryId: string, callId: string): Promise<void>;

    /**
     * This is called when the container is doing an undo/redo or is loading the
     * initial document into all of the trees. This will include the patches
     * that the tree sent to the container with addHistoryEntry and
     * addTreePatchRecord. If the tree did this right, it should only include
     * patches that are modifying the tree's state, it shouldn't include patches
     * that are for the shared model views that are mounted in the tree.
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
     * tile's tree. It will be called after startApplyingContainerPatches. The
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
