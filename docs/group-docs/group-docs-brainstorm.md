

# Summary

We want to add group documents to CLUE. This is where the group of students can collaborate on making a single document. It is very hard to get full Google document style collaborative editing for all of our tiles. So we are trying to get something working that is useful but not as collaborative as Google docs.

The areas where collaborative editing is difficult:

- **conflicts**: when multiple people are editing parts of the document that share state  
- **undo**: a standard pattern is for collaborative undo to only undo the current user’s changes, not some change that another user is making. Imagine two people editing two paragraphs of a google doc.  
- **animations and simulations**: when an animation or simulation is running it is often updating the document if this is running on multiple computers at the same time these document updates will cause continual conflicts  
- **external local data**: when a tile is using data that is only available on one computer. A current example is DataFlow being connected to sensors and outputs.  
- **component/dom state**: examples of this are drafted text, cursor position, focused element, and item being dragged. When updates come in from other users, even if the state doesn’t conflict, the component might need to re-render to show the update. This re-render often will break or reset the component/dom state.

Of these areas it seems only undo could be punted for now. All other areas have to be dealt with at least partially. We have to deal with conflicts at least in some way because they always happen. This work is being paid for by projects using DataFlow which runs a simulation, and works with sensors and outputs. If one user is editing a text area and the other changes some other part of the document we need to make sure the cursor and draft text of the first user is not lost. And if a user is dragging a node in dataflow we need to make sure that operation isn’t interrupted when another changes some other part of the document.

# Conflicts

We should start with handling conflicts. Getting the document model updated when two users are changing it at the same is the basis of everything else. The common way to handle collaborative editing is to send actions to all users editing the document instead of, or in addition to sending the full document state. This way the intent of the user’s change is captured along with the result. This makes it possible to make automatic decisions about resolving conflicts. CLUE is already recording each change to the document in its history entries. However this history system is missing several pieces so it can be used for collaborative editing. 

Because we can’t solve this problem perfectly, it means in some cases student work is going to get lost. This will be referred to as clobbered work. We might be able to prevent clobbered work by locking areas of the document, so users can’t edit them when they might lose work. However initially we’ve decided to just let the clobbering happen. We hope to incrementally reduce how much of the document gets clobbered as we put more development time into this. There are many variables that determine how hard it will be to stop clobbering various parts of the document. With that context we’re planning to start with just clobbering the whole document when a new change comes in.

# Breaking down the work for Full Document Clobbering

The first 2 “stories” (GD-1 and GD-2) move us forward but will not be safe to release because the user experience will be terrible and because it will create a corrupted history.  The next two stores (GD-3 and GD-4) are to help with debugging the inevitable issues that are going to come up. Finally GD-5 should get us to a safe point.

At the end of these stories the document and history should not be corrupted when multiple users are working on the document at the same time. The user experience might still be terrible though. It is likely that a user working on one tile will lose work when another user is also editing the document, even if this other user is working on some other part of the document.

- **GD-1**: create a basic UI that at least works in demo mode to open a group document on the right side of CLUE. The group document will not be safe at this point. It will be opened in standard write mode for all group members, this means that each member’s writes will just override the other group members and changes from other group members will not be seen by the current user. Additionally the history recorded for this document will be broken: it will have history entries interleaved with each other. Testing procedures should be made which cause these problems to happen. This way we can make sure the next step fixes them. The tests at this point probably don’t need to be automated, just a description of actions to take which will break it. Getting this point requires basic UI, and also a location to store the group document in Firebase, as well as a probably a new document type so we know to treat it differently in various places.  
- **GD-2**: update the group document so it is opened in a new mode that supports both read and write. The UI of the document is opened in write mode. For the “read” side, it needs to monitor the history entries from Firestore. When a new history entry is added to Firestore, this history entry should be applied to the current document model just like when a user does an undo. This should cause the UI to update just like it does when an undo happens. That includes running the shared model update code just like the undo system does. The history system currently tracks history entry indexes in a way that won’t work correctly with this. It might be necessary to fix that in order to monitor for new history entries. I believe currently the index calculation assumes only the one user is adding history entries. Whatever this updated approach is, it will be temporary, so it isn’t necessary to fix all of its problems. The full content of the document should continue to be written to Firebase just like it normally is for other documents. The goal of this step is to demonstrate that we can update a local document with changes from firebase and also send the local changes to firebase so other users can see them too. It will not handle the case of multiple users making changes at the exact same time. However it should be good enough to do a careful demo where only one user makes a change at a time and then pause a bit before the other user makes a change. We should see if there are any issues even when being careful and changing the document slowly.   
- **GD-3**: make debugging feature which makes it possible to reliably break the basic read write mode above. There should be a button or hot key which pauses the posting of history entries to Firebase, and then it can be toggled off so the posting of entries is resumed. With that delay it’ll be possible for another user to post a conflicting history. It is these conflicts which are the crux of making this a reliable and safe system, so we need a way to deterministically cause these conflicts. With this tool it should be easy to break the recorded history again so a teacher replaying history will run into problems. It should also be possible to break the current document if two users are changing the same part of the document. The patch from the server will not be able to be applied correctly so then the two local documents will drift apart or the app will fail in some way. These issues should be verified, so we can confirm that we’ve actually fixed them with the future work. At this point it is probably best to just do this manually.  
- **GD-4**: basic history viewing UI. This UI should show a list of history entries along with the user who did the change that caused the history entry. Currently this is done just in the browser console and it is painful to use. The history is a key part of how these group documents will work, so being able to inspect it should help track down many problems faster. Additionally, this kind of history view is probably going to be required for end users in future. For example there are going to be problems that are just inherent in working on a document together, having a history viewer will make this visible to users so they can be more confident in the system. Also if we implement undo which only applies to the current user, the history view could be a way for a user to rollback changes made by classmates. For this initial history viewing story, none of these user facing features need to be implemented. I just include them as a rationale for why this story is worth doing, and to give more context for deciding how to implement it.  
- **GD-5**: update the history writing so it uses firebase transactions to make sure that new history entries are based on already written history entries. This requires a firestore document at the “history” path of a firestore metadata document. This firestore document should have a field with the currentEntryId. When adding a new history entry to Firestore, this currentEntryId should be read within the transaction first. If a new history entry has a previousEntryId that doesn’t match this currentEntryId, the transaction should be aborted. This local uncommitted history entry should be “rolled back” by applying the history entry’s undo patches.  In the future we’ll try to merge history entries, but for now we’ll just roll them back and lose the local changes. If the new history entry’s previousEntryId matches the currentEntryId then the new history entry is added to Firestore and the currentEntryId is updated. This roll back process has to be matched up with the history reading code. Just before or during the transaction a new history entry might show up, so this will have to be queued until the rollback happens. Also the undo stack has to be updated when a history entry is rolled back. And finally the updating of shared models needs to be waited for, we don’t want to apply new changes until the shared model updating to finish. This might require some kind of extra queue to track any new historyEntries which can’t be processed yet. At this point the system might be safe enough to release to real users. We need to play with it to see how stable it is and see how bad the “roll back” effect is. Using the debugging tools above we can create scenarios to see what the roll back is like. 

We might be able to stop at this point, maybe things will be good enough. However it seems likely several issues will make this not really usable. Here are some cases to test:

1. The user is typing in a text area while a second student is updating the document. We do not save each key stroke, we wait a few seconds before saving the text. So if a change comes before the text is saved, the text will likely be lost. This wasn’t a problem with undo because the user would want their text to be lost if they hit undo. Maybe this won’t be a problem, but we need to test it. Maybe this will only happen in the rollback case where some text was just recorded locally but hadn’t been saved to the server yet. If another user is doing something that causes a lot of history events this could be very annoying.  
2. Drag actions the user is in the middle of might get lost. For example the user is dragging a dataflow node around and then a change comes in that rolls back their recent dataflow changes. The node they are dragging might not exist anymore. Or perhaps the change will cause the dataflow tile to re-initialize itself. That re-initialization will probably lose the dragging action even though there were no other changes to the dataflow tile. Again we need to test it.  
3. Selections. It is likely that any tile that is reloaded will lose its selection, or maybe in some cases the selection will be wrong.  
4. Dataflow generates new history entries on each tick. This is likely going to cause some major problems for this system. Particularly since both users are going to be constantly generating conflicting history entries. Therefore we are going to have to solve the DataFlow history problem before this system can be used with DataFlow tiles.  
   

A good way to try to find these problems is to just have 2 to 4 users use it at the same time. And see what unexpected things happen. Then we should document manual steps to reproduce these problems. That will require the debugging tools above. 

# Random Notes

## Location of Group Doc in Firebase/Firestore

It should be fine for group docs to just be stored in the same place in Firestore. They’ll have a document id and a metadata document just like every other document. They probably need a new type of group in their Firestore metadata, so they can be filtered and labeled properly.

In Firebase it is more complex. We can’t follow the existing pattern. That pattern has top level documents under:  
/{classPath}/users/{userId}/documents/{documentKey}  
We don’t have a class level group identifier in this case. The group identifier is just for the offering. So we’d have to store the group document content under:  
/{classPath}/offerings/{offeringId}/groups/{groupId}/documents/{documentKey}

And currently there is a mix of metadata stored in firebase and firestore. In this case lets try to just use the metadata in Firestore to keep things more simple.

The firebase and Firestore rules will likely have to be updated to support groups when run from the portal.

## Work after GD-5

We should also watch out for document drift. The stories above do not ever update the full document stored on the server. This full document should be watched by all clients and they should make sure their local document is staying in sync with it. **TODO**: make a design for how to do this. It probably requires saving the current history id with the remote full document if it isn’t currently being saved. And it also means we need to save this updated document in the transaction so it only happens if the history entry is also updated. 

Assuming we find problems that make the group document unusable, the next step is to implement merging of history entries. There are many levels of this.

- **document level**: some changes at the document level should not conflict with other changes. For example new tiles, tile layout, document name (I’m not sure about this one). So adding a new tile shouldn’t break the flow of other tiles. So the new tile change can be merged into the current document without rolling back the current document changes first. We need to review the structure at the document level but it might be safe to say that anytime there are no json patch overlaps for changes at the document level the changes can be merged. An example of a case that would not be handled is both users adding new tiles to the end of the document at the same time.  
- **tile and shared model**: if two tiles are being changed at the same time, as long as the tiles are using the same shared model, we should be able merge the changes without rolling back the current document.  
- **tile or shared model**: if the shared model is changed by one user and a tile using that shared model is changed by another user, we can try to merge these changes. There should be some cases where this will fail though. Some tiles refer to objects in the shared model either with official MST references or just strings. If one user is adding a reference to an object and the other user is deleting this object, the simple merging of these changes will result in a broken document. We are already treating these references specially in order to handle copying a tile and its shared model together. So the code that is doing that should be generalized so it can be used to also identify conflicts before the merge operation.

 We can start by only merging changes that do not overlap at the tile and shared model level. So if user A changes tile A and user B changes tile B, and these tiles don’t share a model, then we can just update the history entry’s parent id to be the incoming id. And the incoming changes can be just applied out of order to the document. This ought to prevent focus, drag, and selection problems when the changes are in different tiles. This would be level 2 above.

A next step after this is to merge changes in a shared model even if there are also changes in a tile using this shared model. This step is harder because. 

-  At this point we can explore the different tiles and shared models and see what can be broken when happens when one user makes a change that This first version will have problems when there are conflicts of history events. Tests should be developed which can cause these problems to happen. Probably both manual and automated tests should be created. Both will require mechanisms to slow down updates to force the conflicts to happen. This document UI should be opened in standard write mode, when a change is applied it should behave like when an undo or redo change is applied.   
- update the history writing so it uses firebase transactions to make sure that new history entries are based on already written history entries. This requires a firestore document at the “history” path of a firestore metadata document. This firestore document should have a field with the currentEntryId. If a history entry is attempted to be written that has a previousEntryId that doesn’t match this currentEntryId, it should be dropped and the document model reset to the most recent valid history entry. This “reset” to the most recent valid history entry will overlap part of the time with the procedure of handling new history entries. However the current user can make a change after a new history entry is written by someone else but that new history entry hasn’t been applied to the current doc model yet. We’ll be throwing out this current change in this case, so we need to reset the current user’s document back to a known state. In future stories this will be handled by attempting to merge the changes instead of just throwing them out. It isn’t clear how best to reset the document. An undo action could be used or we could store the full document model for the last N history entries, and revert back to that.   
-   
- make a dev environment to make it easy to test and fix problems that will come up from this work. This would be an extension of the editor, which has side by instances of the same document. It either needs to work with Firestore and Firebase just like the real CLUE. Or it should work with an emulation of those systems.  
- make a feature in the document editor where a document from the demo mode of CLUE can be viewed  
- extend this document editor viewer feature so that it updates its document based on the history written by the owner of the document instead of monitoring the content in firebase for changes. In this mode it could still monitor in firebase for changes   document viewer that starts with the firebase content and then applies history updates as users make changes. This is essentially what the history document viewer is already doing. So questions with this are:  
  - where to put this history based document? If we have a place for a group document in the UI we could use that.   
  - this initial version could be just read-only  
  - it?just uses history to make its local document instead of using the firebase content.  
- it seems like it can be implemented using transactions with Firestore. The reading of the current history id is done and then the new entry is written if the parent matches, if the parent doesn’t match then the transaction is aborted, and the new history entry or entries from the server are applied to the document which is rolled back to its value from before this time. Then the new change is sent to the server again. Part of this I’m not sure about is how the content in Firebase is updated. We ought to keep this in sync with the history. We could put the updating of this content in this same transaction and only do it if the transaction succeeds. I’m not sure this would block someone from getting an inconsistent combination of the history and Firebase content. That could happen if they read the content first and then read the history. I think the content read will not be blocked just because there is a transaction going on. So this could show content from before, and then show history that is newer. I think as long a clients only use history or only use content this won’t be a problem. My concern is divergence if the history is not applied the same by different clients. So it seems useful to have some kind of checkpointing process where the content is used when it catches up. We could just monitor it and if it doesn’t match the local content then print a warning for now. I’m not sure how long this comparison will take.   
- In Level 1 we need to identify when the document was changed by someone else and then reload it. To implement this we need the transaction system above and 

## How should changes be applied

For this section we’ll call the MST document model used by the CLUE UI the **local document model**.

There are are a few ways changes can be applied:

- directly to the local document model  
- a copy of the local document model can be made, and the changes applied to this model copy, then a snapshot of this model is applied to the actual model  
- bypass MST entirely and just patch a JSON object with the changes and then apply this new JSON to the actual model

When a new change comes in from the server and it doesn’t conflict with the current document, it seems like it should be just applied directly to the local document model. We can try just applying these changes without reloading the full UI. This should be the same behavior that happens when a change is undone by a user and the tile’s model changes out from under it. However there might be some tiles that don’t handle undo very well, or have custom code that is running during undo.

When a new change comes in from the server but its parent history entry id is different from the current one. We have a conflict. Initially we’ll not support merging so we just want to throw out the local changes. The new remote change needs to be applied to a version of the document that matches its parent history entry id. It’s possible multiple history entries will arrive that haven’t been seen before. So we need to reset the document to the first history entry that has been seen before. 

One way to do this is to keep copies of the document around for each of the recent history entries, perhaps the last 2 history entry documents would be enough. Or perhaps we want to base this on some amount of time. Another way to do this is to use the “undo” part of the local history entries in order to reverse the document to this known history state. Either approach could lead to “drift” if there are long running sessions. TODO: add a section about dealing with drift.

Whichever approach is used we might not want to do these operations on the local document model. If the UI re-renders during the reverting and updating process it will flicker unnecessarily. I believe that tiles that use onPatch will get triggered in the middle of this operation. However if all of this can be done synchronously it might not be a problem, so we should start by trying not to make a copy and seeing how it looks and performs. 

If we do need to streamline this, we can do these changes on a copy of this model. It could be a real MST copy, or it could be just the JSON snapshot. The real MST copy would be safer and allow us to add customizations in the model objects for handling special cases. However it will be more memory intensive since we are loading in a full copy of all of the MST objects. The JSON snapshot approach is lighter weight. It also could be used in a server process that doesn’t have access to the MST model code. However, the patches of the history entries are based on the model objects so if a model customizes its snapshot the patches will not apply properly. For all of these reasons it seems best to try using a real MST copy of the document model, if we do have to make a copy.

## Conflict resolution

There are cases where we can be sure there are no conflicts as long as the implicit rules of CLUE are followed. For example when two independent tiles are edited. These cases could be identified by rules. It is probably best to make the default to assume there is a conflict, and then create rules to say this is not a conflict.

If the two sets of patches are both changing the same JSON property, or one is deleting a parent of another patch’s change we know this is a conflict. But even this is hard to identify with the current form. The patches of one change might add and remove and re-add things. So with our current patches we’d have to evaluate all of them and then look at the result instead of looking at them individually. 

A next level up would be a MST level conflict. For example if one patch deletes an object and the other patch is adding a reference to this object. This would probably not be a JSON patch conflict, but MST would catch the reference change as invalid.

Additionally there are cases where the patches would not conflict and the MST would not see the changes as invalid, but they still are. I’d call these semantic conflicts. In the case of the table it refers to attributes with string ids so if a new column is added to the table but the attribute it is referring to is deleted. This is why the default is to assume a conflict. 

One approach to address this is to define each action semantically, not just with JSON patches. We are actually doing this already. However this is done automatically based on the “root” MST action name. Each of these semantic actions can define:

- preconditions: these are checks to make sure the action can succeed. I’m not sure how these are actually defined. Perhaps it is sufficient to define them declaratively: “this object must exist”. But maybe it is necessary to run code?  
- if a precondition fails then action needs to define how handle this: no-op (remove action), transform the action to work with the existing document, or run some repair step  
- have a set of "integrity repair” steps that run after each action or batch of actions. These can be used to clean up orphaned objects for example. It’s a place to put global rules that don’t need to be defined in every single action that needs them.

The integrity repair step fits with the idea of tile models defining their references. So just like they define how to handle updating their reference ids when being copied. Similar rules can be defined for how to “repair” a missing reference after the operations have been applied. In the case of a column referring to a deleted attribute, the “repair” would be to delete the column.

I think there might be another level here which will help. We can say “when we can’t handle a conflict” then we just pick a winner. This way at least people can keep going and the document is still consistent. So a key thing seems to be how to define when we can handle a conflict.

For lists that have lots of updates we could try to figure out how to mix MST with CRDT lists. Probably we could make a new array type that presents as an array but internally is a crdt list, but its hard to see how we could then mix this into the applySnapshot and applyPatch approach to updates.   
Something to look into are CRDT lists. These were referred to, but I don’t remember what that means.

### Change \+ Delete Tile Example

If changes are isolated to a tile and the conflicting change doesn’t change that tile at all, we still need to check for a deletion of the tile. We can initially just treat that as an unhandled conflict. So then the whole document get rolled back. 

If the delete makes it to the server first, we can just rollback the other changes in the tile. For research and debugging purposes, it’d still be good to record this rolled back history entry. Perhaps the best way to do this is by putting it in a separate collection in Firebase. It ought to have a parent history entry id, and maybe an index (if we keep those), and a timestamp. And a conflict reason should be added to it if possible. This is enough info to be able to look at it later. This could also be used to notify the user that some changes were not applied. AI’s suggestion is to show the user a message: “Some edits couldn’t be applied; click to review”. I guess the “click to review” would show the names of actions which couldn’t be applied. This shouldn’t show all changes from all time, but just the ones related to this message, so in our stores well need a property which refers to these un-applied edits, and then after the user sees them we clear this property.

If the tile change makes it to the server first things are more complicated. We cannot just apply the tile change to the local model. It will fail because it will be trying to change something that doesn’t exist anymore. We can just skip applying the tile change to the local model. However we need to update the delete\_tile history entry so the document will be consistent if the delete is undone or someone is using the history slider to go backwards. What we need is for the undo patches of the delete\_tile history entry to make the tile be in the changed tile state. We could try to handle this by updating the server history and basically removing the tile\_change entry from the server history, but that messes with the parentEventIds and will need to be propagated to all of the clients. So it is better to update the delete\_tile entry. One way to do this is to add the tile\_change “do” patches to the “undo” patches of the delete\_tile history entry. This will likely be good enough, but it should be noted that it is doing extra changes. In this case the tile is undeleted, then it is set to its state before the tile changes, then the tile changes are applied. This is kind of a mix between what happened on each of the clients. If there is complicated logic that happens from observers that are monitoring individual patches this might result in a document that is in a different state after the entry is undone. For example if an observer is monitoring the adding of new tiles and then waiting for some part of the tile to be initialized, this might be triggered during the first set of changes instead of waiting for the final set of changes. In this example it seems really unlikely that anything is doing that, but perhaps in other conflict cases doing this approach of updating the undo patches will cause problems.

Thinking through this from the perspective of the users. Perhaps the one that just made the change will say hey I was working on that. If we only allow “local undo” then they will have to convince the other student to undo the delete. If the student making the changes got their work in first it will be recovered. If the student making the changes didn’t get their work in first, it will be lost. As long as we are saving at regular intervals this shouldn’t be too much work.

## Undo/Redo

Undo redo brings new challenges here. We can probably start by just disabling it for group documents. But assuming we don’t, then we have to decide if user A can undo user B’s changes. Doing that seems problematic. I believe in google docs a user only undo’s their own changes. 

We have to partially deal with undo/redo in order for the history slider to work for group documents. 

But if we want to support undoing only the current users changes things get complicated. To support this we have to figure out if a user’s change can be undone even though it is out of order.

A basic case is: user A added a tile, then user B edited something inside of the tile. Now user A hits undo. We could delete the tile and that would lose user B’s changes. Or we could say this entry can’t be undone by user A. Perhaps we could determine that because we could see that changes which are not undone would conflict with change that is intended to be undone. We might be able to identify this when the change is first made, so then we reset the undo stack for user A. This might be annoying though because it would make it seem like undo is unpredictable or broken. We could show a message indicating why it couldn’t be undone, and given the user an option to undo the change anyhow.

There are probably more complicated cases though where it isn’t as obvious there is going to be a conflict. It seems likely this conflict identification and possible resolution is the same as what happens to support collaboration. So perhaps whatever level of solution we come up with for collaboration will be as good as we can be with undo. If we do this right, it also provides another way to debug conflict handling. When a user is undoing their own changes it is easy to cause out of order changes without messing with the timing that the changes make it to the server.

## Showing the history

Because we can’t always support undo of your local events, showing the history and giving users the ability to revert the document back to some point in history seems really important for a good user experience. Showing the history also will really help with people reporting un expected behaviors. If we can have them open the history and either send it to us, or perhaps even just see the history they might realize why something un expected happened. And it gives us something to point at when describing the complexity. 

## More Notes

However the proposal is that we could do this at the document level and only allow one user to edit a tile at a time. Maybe certain tiles could support multiple users editing them at the same time.

The problem with this locked tile approach are the shared data models. If there are two tiles which can both edit the same shared model then locking individual tiles will not prevent conflicts.

There are probably multiple ways to deal with this. I’d hope that making shared model collaborative would be easier than making tiles editable. However, the dataset shared model does include selection I think, so it would be easy for this selection to get broken when edits happen outside of the current document.

What we propose for a first step to this is whatever is the simplest approach that won’t crash CLUE. It is OK if student work gets clobbered because we can’t figure out how to resolve the conflict.

Cases that might crash CLUE:

- a tile updates a shared model in a way incompatible with another tile, this other tile is not able to handle this change so it crashes. In a single document senario this case might be handled by some volatile state that is shared between the two tiles via the shared model.  
- two or more users updating the same document cause the update system to get into an infinite loop. This can happen if document changes from the server cause those document changes to be reposted to the server. Basically the online document would be updated by user A. This change is sent to user B. But before user B gets it, a user B change gets sent to the online document. Now this user B change goes to user A. In the meantime user B gets the original user A update, and since this changes its document, this update is sent back online. This same thing can happen on user A, so then an infinite loop can happen.

Ideally we could do some initial implementation of this without dealing with tile locking. So that any changes to the document would just override all changes on the server. The problem with that is that most tiles cannot handle being updated by their model and also updating their model at the same time.  The tiles have a read-only mode that is used when they are updated by their model. And a write mode is used when they are updating the model. In the write mode the tile can be the owner of the state and the model is just a copy of this state so any watchers can see it. 

If we want tiles to be both read and writer at the same time, they have to handle merging changes from their model with their internal state. If we use tile locks, then the tiles could still keep the “read” or “write” modes, and CLUE would take care of switching them.

Another version of this is to lock the whole document. So the first student to start editing it gets the lock, the other students see a read only copy of the document. Then the first student has to do something to give up the lock, perhaps something like a “done editing” button. The other students could click an “Edit” button, and if the document is current locked it could be called “I want to edit”. The user that is currently editing could get a notification that the other student wants to edit it. So they can hurry up and finish their change.

What would happen if we do nothing and just let multiple users edit the document at the same time? The current design does not watch for changes to the document when you are editing it. So in this scenario everyone would be writing their own version of the document starting from its initial version when they first opened it. The server would see flip flopping versions of the document as different users write it. A user watching the document would see this diversion as it is flipping around. This might cause bugs that we haven’t seen before as the components are whiplashed back and forth.

A possible problem with this simple approach is how history is recorded. The history events do keep track of their parent event, so they should be able to be used to show the branching that happens with this approach. However I don’t remember how the history figures out the most recent event when a new user starts up. If it uses the revision id from the document then it would just get the history entry of whichever user had saved the document last. But I think the events are currently just ordered based on some incrementing number. In this case of multiple editors this there will be multiple events with the same number. When this history is replayed it will break because the changes in one event will have been recorded against a document that is different than the “previous” event in the history. 

This issue should be fixable by using the “previous” history id that is recorded in each event. These “previous” history ids can be used to know which of the multiple events with the same id to choose. We could in theory generate a git like history graph of the changes. It isn’t clear what do with this information on the history scrubber. When the scrubber hits a branch it would have to pick one side of it, or let the user choose. Perhaps we can just one branch but have a UI that shows all of the branches and then lets the user choose which branch to use at each branching event. Because this approach is not sustainable, it probably is good enough for the scrubber to just choose one, but also show there are multiple branches.

## Option A

No locking, just show students the version of the document they opened, and then their changes are built up based on this. The “saved” document is just based on who made the last change.

### Changes to support this

- Update history scrubber to follow the previousEntryIds instead of just the position numbers.   
- Make a view that shows the branches in the history  
- Add a user id to each history entry, this way the view with the branches can show which user made each change  
- Update the history loading code. It seems like it currently assumes a single branch of the history. It should look at the revision id of the document and use that to get the previous history entry instead of just using the last history entry that it finds.   
- The history loading code also need to take into the account the branches when computing the `lastEntryIndex`

## Notes from a Slack conv with Leslie

I think the complexity of the work will be based on how fine grained the "clobbering" happens. 

### Level 1

The least complex is at the whole document level, lets call this level 1\. 

### Level 2

The next level would be "tile+shared model", level 2\. At this level, if anyone makes a change in the same tile you are editing or any shared models used by that tile then any un committed work is lost. 

### Level 3

Level 3 is tile and shared model independently. So you could change something in a tile, for example column width, and someone else could change the shared model and neither would lose work. 

### Level 4

Level 4 would allow some simultaneous changes to some parts within the same shared model as long as they are not the same part (like a cell), but simultaneous changes to the same tile state would be lost. 

### Level 5

Level 5 is simultaneous changes to some independent parts of the same tile. 

We could keep going to the character by character level but I'll stop before there.  
I'm guessing you are thinking of level 5\. I don't think that will be doable in 6 weeks. It will also likely increase the complexity of the code itself especially if we are trying to implement it quickly.  
Level 4 might be doable in 6 weeks, but I wouldn't say that's guaranteed.

I think with the design I have in mind, once we get to Level 1 we can incrementally add support for the more complex levels. This would have the nice effect of showing CLUE users some progress as well as probably showing how it takes longer and longer to implement each new level.  
What I described in the meeting today is even simpler, so I'll call that level 0\. (edited)

## DataFlow Issues

In order to use the history like this we probably have to deal with DataFlow’s generation of history entries. I think DataFlow is generating lots of history entries while is running. 

## **TODO**: look into this more. Is there some easy solution to how DataFlow is working? Or do we need to tackle the hard problem of simulations/animations and how their intermediate state is saved in documents. 

## Possible Goals for 2025-12-19

- Document where and when the conflict detection and resolution will happen.   
- Get started on a prototype of the first few bullets above. This will mean I won’t get as much done on this design. I will get caught up in this.

## Questions

How should the changes be applied:

- directly to the real MST model used by the CLUE UI  
- to a copy of the MST model and then a snapshot of this model is then applied to the actual model  
- bypass MST entirely and just patch a JSON object with the changes and then apply this new JSON to the actual model

These changes have to be applied in a few cases:

- when a new change comes in from the server and it doesn’t conflict with the current document, in this case it should be easy to apply this directly to the real MST document.  
- when a new change comes in from the server but its parent history entry id is different than the current one. The change needs to be applied to a version of the document that matches the parent history entry id. Then the current changes need to be added back on if possible. If we are working with the actual model this would result in the local edits being removed an re-added. Perhaps if this all happened in a single MST action it wouldn’t trigger any changes if the local edits just end up the same. However it seems it’d be safer to work on a copy or the raw JSON and then just apply this all at once. As long as both of these approaches can be done synchronously there shouldn’t be a chance that the main document changes in the middle of the process.

Where in this process are we going to refresh tiles that have internal state? Tiles that don’t use MST as the main model keep a copy of this model in internal state. In read only mode this internal state is updated whenever the MST model changes. In write mode the MST model is updated whenever the internal state changes. In write mode the internal state is only updated from the MST model on first load. In this new collaborative doc approach we want to incrementally add improved support to some tiles so they can be in a read-write mode. But to start with we want a safe process where existing tiles just work but with degraded behavior. So in this mode an initial version might be to open all tiles in write mode. Then whenever a change comes in that affects that tile we re-load it after the change has been applied to the document. A more advanced version of this would be to open the tile in read mode, and then when a user clicks into it to edit, then we switch to the write mode with the re-load behavior. 

So to implement the write mode re-load behavior, we need to identify when a change will affect a tile. In Level 1 it means the whole document will be reloaded whenever a change comes in. In Level 2 this means that any changes to this tile or its shared models will cause the tile to reload.

Because the tiles are working with the actual tile state, we might be able work on this reloading behavior manually. Some UI could be used to trigger a tile reload. But it is hard to figure out if this would be useful. Maybe it’d be useful to build a mode where we keep two copies of the document. One copy is what is being actually used locally. The other copy is updated by the history events 

## Common issues

-  If the user has their cursor inside of some part of this document that is being updated, that cursor might go away.

Should the changes be applied to the actual MST model of the document that is being used by the views