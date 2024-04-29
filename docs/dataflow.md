# Program Views

There are several ways the program can be displayed:
- a live editable view
- a read only view when looking at the document on the left of CLUE
- a read only view in a thumbnail of the document
- a read only view when the program has been recorded

When testing or updating the code of programs there are 4 cases to handle:
- **single live view**: there is just one view of the program and it is editable.
- **live plus readOnly views**: there is a live view of the program and there are other readOnly views in the same application displaying the program.
- **only readOnly views**: there is one or more readOnly views and no live view.
- **recorded program**: the program has been recorded and the user can play it back.

## Single Live View
This is the easiest and probably where you'll start your development. You can use the /doc-editor.html to work on this case.

## Live plus ReadOnly Views
This will happen when you have the same document open on the left and right side of CLUE at the same time. In some cases it is possible for a thumbnail of the document to also be active (sometimes visible sometimes not) at the same time.

## Only ReadOnly Views
This can happen when a user closes the live document on the right of CLUE and is just looking at it on the left. However that case doesn't usually cause problems. The harder case is when a second user is looking at document that is being edited by another user. The best way to test this is to use the CLUE `demo` mode to open a student browser tab and teacher browser tab for a class and then edit the document as a student and view the document as the teacher.

## Recorded Program
After the program has been recorded, a copy of the program is created and is displayed using a readOnly view of this copy. This readOnly view is updated when the user plays back the recording. The mechanism of this playback is not the same as the mechanism for showing a readOnly document to another user.

# Dataflow processing

Nodes can support data flowing through them using the `data` method. This method gets the input values from its input sockets, and needs to return the output values from its output sockets. The input values are arrays since in theory each input socket could have multiple connection to it. We do not support multiple connections to an input socket, so the arrays will always have 0 or 1 values.

The program has a `process` method which calls the `data` method on all of the nodes. The order the node's `data` methods are called is based on program connections. Nodes which are inputs to other nodes have their `data` method called first. We don't currently support loops. Additionally during a single `process` the `data` method is only called once on a node. The value of this single `data` method is cached and used as the input for any nodes connected to it.

The program is "processed":
- when the program "ticks". This happens at the period of the selected sampling rate
- when the program is first loaded
- when a node calls `process` because the node changed one of its values which will affect downstream nodes
- when the state of a readOnly program is changed underneath it

In an application with multiple views of the same program only one of these views is the "main processor". If there is a live view of the program this view will be the "main processor". When there is no live view of the program one of the readOnly views will be the "main processor". It is this processor which calls the `data` function on the nodes.

## Tick Support

Several nodes need to do different things during the tick that they don't do during other `data` calls. This is done by checking the `services.inTick` boolean in their `data` method.

- Input nodes: use the tick to "inject" a new value into the diagram. These are Sensor/Input node, Number node, Generator node, Timer node.
- Output nodes: use the tick to "send" a new value to their output. Currently just Live Output uses this.

Additionally each `watchedValue` of the node is recorded on each tick. These recorded values are used by the plots beneath each node.

In a readOnly program, there is no tick. The `data` function will only be called when the program is changed underneath it. This is why the "only readOnly views" case described above should be tested.

# Location of Node State

Nodes can store stuff in several places:
- **node model properties**: these values will get saved in the document, sent to any readOnly views of the tile, and will reload
- **node model volatile**: these values will not be saved in the document, and not sent to a readOnly view that is in a different CLUE tab. They will be shared with readOnly views that are in the same CLUE tab. In otherwords they aren't shared with remote views of the program.
- **tick entries**: *coming soon* these values will be saved in the document, and are related to a specific tick. They are shared between all of the views both local and remote.
- **node instance properties**: these are not saved in the document, and not shared between any of the views.
- **control instance properties**: these are not saved in the document, and not shared between any of the views.
- **control component React places**: the controls have React components so they can use React state or React references to store state.

In order to support the different program view cases described above, some conventions should be followed.

## Node Model Properties
This should be where settings the user can change on the node are stored. Such as the value of a drop down menu, or a numeric input. The `data` method should never update these properties. If it does it will cause problems with the undo system.

## Node Model Volatile
This is where nodes should put state that can be "recomputed" by a readOnly view's `data` function. By storing this state in volatile we will not bloat the state of the document and eliminate the chance of conflicts caused by undo. These properties are usually used by controls to display information about their controls.

## Tick Entries (coming soon)
This is where nodes should put their main `nodeValue` and any state that can not be "recomputed" by a readOnly view.

## Node Instance Properties
These are usually used when a node needs to work with a control after it has been created.

# Recording and Playback Support

A key part of recording and playback is that the diagram is locked during the recording. So the user cannot change numeric inputs or drop down menus of the nodes. And after recording the program remained locked until the user clears it. This way the user can playback the recording and the only information need for a near perfect playback are a single value from each nodes. These values are stored in a dataset so they can be used by other tiles in CLUE.

A recorded program is played back by making a copy of the `DataflowProgramModel` MST object and creating a `playbackReteManager` with this model. This `playbackReteManager` is bound to a second div in the DataflowProgram component.

Then on each "tick" the DataflowProgram updates each node's value from the data in the dataset. The dataset does not include the inputs of each node. The `process` is run after these values are updated.

In most cases this provides enough information for the node displays (sentences or displayValues) to show the same value the user saw when the program was running for real. The one current exception is the control node (Hold block) which can't tell if its "wait" timer was running during the playback tick. So in this case the control node shows a slightly different display.

