import { TreePatchRecordSnapshot } from "./history";

export interface ContainerAPI {
    /**
     * Propagate shared model state to other trees. This is called by either by
     * the top level container tree or by iframe trees.
     *
     * The shared model is identified by an id inside of the snapshot The
     * sourceTreeId indicates which tree is sending this update. The new shared
     * model snapshot will not be sent back to this source.
     *
     * Note: The returned promise should only resolve after the shared model has
     * been updated in the container and in all trees that are using the shared
     * model. The promise does not guarantee that all of the tiles have updated
     * their own objects related to the shared model. In particular when this is
     * called when applying patches from an undo or redo, the tiles will
     * explicitly not update their related objects because they will receive
     * patches that should contain these changes separately.
     *
     * This promise is needed because we need to stop some updating before
     * replaying a history event, and then we need to start it up again
     * afterward. So we need to know when the history event has been fully
     * applied. When the history event includes changes to a shared model, fully
     * applying it means the tree of the shared model has sent its changes to
     * all of the trees that are using it. So when the shared model tree gets
     * the applyContainerPatches call it then calls this updateSharedModel and
     * waits for it to resolve before resolving its own promise. 
     *
     * The returned promise will also be used when a user event is sent, we need
     * to make sure the container has received this update message before the
     * tree tells the container is done modifying the historyEntry. In this case
     * it isn't necessary for the returned promise to wait until all of the
     * trees have received the message. That could be the responsibility of the
     * container. Perhaps we can simplify this so this call doesn't need to
     * block until all of the trees using the shared model have been notified.
     * That blocking could be the responsiblity of the container after this call
     * is done.
     */
    updateSharedModel: (historyEntryId: string, callId: string, sourceTreeId: string, snapshot: any) => Promise<void>;
    
    /**
     * Trees should call this to start a new history entry. These history
     * entries are used for 2 things:
     * - the state of the document that is saved and later loaded
     * - the undo stack
     *
     * When the state is loaded the container will combine all of the patches of
     * all of the recorded tree patch records and send that to the tree with
     * with `applyContainerPatches`.
     *
     * When the user does an undo the container will send the inversePatches of
     * the the recorded tree patch records that are grouped by the
     * historyEntryId to the tree with `applyContainerPatches`.
     *
     * The tree calling this should wait for the returned promise to resolve
     * and then call a `addTreePatchRecord`. If the tree is also calling
     * `updateSharedModel` it should wait both the updateSharedModel and the
     * `addHistoryEntry` to resolve before calling `addTreePatchRecord`. Calling
     * `addTreePatchRecord` is necessary so the container knows the tree is done
     * sending information about this historyEntryId. Because other trees might
     * respond to a sharedModel update with further changes to other
     * sharedModels this might trigger another change back in the original tree.
     * In order to differentiate between the initiating call and the second call
     * the callId parameter is used. 
     *
     * @param historyEntryId should be a unique id created by the tree. 
     * 
     * @param callId should be another unique id. The container uses this to
     * differentiate between multiple flows of messages being sent to the
     * container. For every addHistoryEntry message there should be a
     * addTreePatchRecord message with the same callId.
     *
     * @param treeId id of the tree that is adding this history entry.
     * 
     * @param actionName name of the action that caused this history entry to be added.
     *
     * @param undoable true if this action should be saved to the undo
     * stack. Changes that result from `applyContainerPatches` should not be
     * undo-able.
     */    
    addHistoryEntry: (historyEntryId: string, callId: string, treeId: string, 
        actionName: string, undoable: boolean) => Promise<void>;
    
    /**
     * Trees should call this to record the actual patches of a history event.
     * They should always call this even if there are no patches. This message
     * is how the container knows the tree is done sending messages with this
     * particular callId.
     *
     * @param historyEntryId should be a unique id. If this tree initiated this
     * history entry with `addHistoryEntry` this id should match the
     * historyEntryId sent in that call. If the changes in this entry were
     * triggered by the container this id should be the `historyEntryId` that
     * was passed in with the message from the container.
     * 
     * @param callId the callId that started this flow of events. It could be
     * created by the tree when it called addHistoryEvent, or it could come from
     * the container. 
     * 
     * @param record the actual changes. If there are no changes this should
     * still be sent with empty patches.
     */
    addTreePatchRecord: (historyEntryId: string, callId: string, record: TreePatchRecordSnapshot) => void;

    /**
     * This starts a new "call" in the history entry. These calls are used by
     * the container to know when the history entry is complete. If there are
     * any open "calls", then the history entry is still recording.
     * `addHistoryEntry` automatically starts a "call".  And when the container
     * calls into the tree with applyContainerPatches, the container starts a
     * "call". This explicit startHistoryEntryCall should be used when the tree
     * wants to start some async code outside of one of these existing calls. It
     * should call startHistoryEntryCall while it is handling an existing
     * "call". And it should wait for the promise of startHistoryEntryCall to
     * resolve before it closes out the existing "call" (by call
     * addTreePatchRecord). This way the not be a time when all the calls of
     * this history entry are closed, so container will keep the history entry.
     *
     * In the prototype of this system this is needed the tree's tiles are
     * updating themselves after the shared model has changed. It is also used
     * by the undo and document store when they are replaying events. In this
     * current subset imported into CLUE it is not yet used yet.
     *
     * FIXME: need a new name for "call". It is used as verb too often. And it
     * also represents the object used by MST to store information about an
     * action. 
     *
     * @param historyEntryId the history entry id that this call is being added
     * to this could be the one that was created with addHistoryEntry or it
     * could be one that was initialized by the container. 
     *
     * @param callId a unique id created by the tree to identify this call. This
     * same callId needs to be passed to addTreePatchRecord to end this call.
     */
    startHistoryEntryCall: (historyEntryId: string, callId: string) => Promise<void>;
}
