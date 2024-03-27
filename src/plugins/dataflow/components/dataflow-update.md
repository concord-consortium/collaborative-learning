# Tasks

- try adding delete button directly to custom component
- try to get our custom styling and elements from v1 into the custom node
- get the styles working for the nodes that we've created
- serialization: see separate section
- get node creation working
- get drop down control working
- get mini plot control working
- fix double click causing a zoom (I remember it being disabled in some of the examples)
- refactor/cleanup dataflow-program
- get tick based calculation working
- figure out how to serialize connections: we could switch to using MST connections, we at least need stable node ids. In the current setup the node ids are updated on each load. This might be an argument to replace the official Node with our own custom MST node.

# Serialization
I think the best approach is to replace the Editor class from Rete with our own class which pulls its info from the Dataflow MST model. Our Editor class can create and cache Rete Node instances that point at the MST node models. These Rete Node instances have the `data` function and their constructor sets up the inputs and outputs of the node.

The connections can probably be direct MST objects unless we need to add controls to them.

The best way to do this I think is to make a subclass of the Editor class and basically re-create all of it. It has to be a subclass because the Rete code uses the scope `parentScope(Editor)` form which uses `instanceof` to verify the parent is the right type.

The default Editor class sends events before a node is created, removed and a connection is created, removed. These events are not used by any code that we are currently using. They are used by rete studio, and the scopes plugin which allows nesting of nodes.

Without these events we should be able to "unify" our implementation to always be based on the MST model state changing. This way if an undo event happens or a remote user changes the MST state the same post events will be called. The biggest problem with this unified approach is the async nature of the Rete add and remove methods. These methods wait for the events to be emitted before returning. If we are sending the events in response to model state changes we can't block the add and remove calls. We can drop that support as well. The two places that uses  these events are the engine and area plugins. In both cases they handle the event synchronously. The probably we might have is if the events are sent out of order. If a connection is made to a node which doesn't exist yet, that might break engine or it might break the connection drawing code. But this seems easy enough to deal with. We can just update all nodes first and then all connections. There might be some issue with deleting a node which is connected too. But this seems like it would be a problem without our new approach anyhow, so we should look into what happens currently.

## Firing events from a single place
There are at least 3 times we need to fire the Rete events for things like the nodes, connections, and positions:
  - explicit UI Events
  - snapshots being applied after the initial load
  - the initial load

If we had code that compared a snapshot with a previous snapshot, and then figured out which events to fire this might work for all cases. For the initial load the previous snapshot wouldn't exist so all "new" elements would have their `*created` events fired for.

This handling cannot be started from a single place though. We can't add an onSnapshot handler which is called when the tile is first loaded. But we could have the code which adds this onSnapshot handler initialize it self when it is added. And this would look at the non existing previous snapshot and send all of the appropriate events.

## Location of nodes

- after loading we need to update the nodeViews of the area plugin
- after dragging we need to update the nodeView that was dragged
- when a new node is added we need to store its location

### MST all the way down
If we can replace the node view implementation then we can get these updates for free. But it seems hard to do that:
- we have to override AreaPlugin#addNodeView to create our own node view class
- the NodeView class has to implement translate, resize, and destroy and provide a element, position, and dragHandler, it also has to manage several things that are passed into it: events and guards.
- when our NodeView instances are modified by something outside of the owning DataFlow tile, we have to send the appropriate events: translate, resize,

### Sync Rete with MST
Without that approach we can:
- call translate after the nodes are loaded and the area plugin is initialized
- listen for the translated events using something downstream from the area plugin and update the MST objects
- this could all be encapsulated in an object that gets both the mst program and the area plugin
- the downside is that it would also have to watch for snapshots being applied and then update all of the translations each time that happens

# Rete v2

## Positions
In v2 the position is stored in the NodeView instance stored in the area.

```javascript
const view = area.nodeViews.get(nodeId)

  if (view) {
    view.position // { x, y }
  }
```

The API for the area plugin doesn't mention this at all!!!
https://retejs.org/docs/api/rete-area-plugin

Looking at the TS types the nodeViews is a just a map of nodeId to a NodeView, the NodeView has actions on it which I assume will trigger updates if they are called directly. Also the demo code calls translate after waiting for the `addNode` to resolve. So if we are deserializing we probably need to add all of the nodes then wait for that to resolve and then translate them all into position.

### TODO
Why do we have to wait after adding them? This might mean a render will happen before they are positioned.

## Parts to migrate

### Controls
This example seems like the best way to see how controls are supposed to be implemented in v2:
https://retejs.org/examples/controls/react

To follow these examples, we have to give up on "plug-ability". And we just need to make a general `Node` class that refers to all possible controls.

The control in this example is just a holder for the data the control represents.

Javascript runtime `instanceof` is used to identify control in the `customize.control(data)` method and then return the appropriate component.

When a control needs to modify other control values, it needs a callback method that is passed through the control into the component. When the user does the action, this callback is called. The callback is created when the controls of the node are created, so it can access the controls created before it was created.

If a control needs to be updated the `area.update("control", targetControl.id)` needs to be called. The ids of controls seem to be opaque. They are not set in the example. My guess is that they are set when the control is created. They do not seem to be in the dom, so that is good.

### Nodes
It seems like we need to replace the current `Component` factory pattern with separate Node classes for each type of node. The constructor of the node type replaces the `builder` function in our existing components. The `data` method replaces the `worker` method in the existing components. This is a good example of this pattern: https://retejs.org/docs/guides/processing/dataflow

There will be a question of wether controls should be stored as instance variables in the node. They might need to be referred to by other control callbacks, however they could just referred to via closures around the variables in the constructor method.

#### Questions:
- Where does the node color come from? Our nodes have different colors, so I guess we still need our custom react component for rendering nodes, and it will have to get the color out of a property stored in a common superclass of all of our nodes.

## Using just the data processing
The engine can be used server side. So we could use this along with react-flow to continuing using its data flow engine. We'd have to take all of the objects from MST create nodes and connections inside of the NodeEditor and then run the fetch call on all of the nodes. And then go back and update all of the models being displayed by react-flow.

## Our previous implementation

### Serialization
We deserialized using a function on the MST objects which generated a JSON format that was accepted by Rete v1's `fromJSON`. This method seems to have been removed.

We serialized the state back to MST by calling Rete's `toJSON` function. And then just applied that directly with `applySnapshot`. Then we have snapshot preprocessors to convert the Rete data into our MST form. The format is very close. It would have been nice to have documentation of how the format is converted.

Additionally, this applySnapshot effectively filters out any data from the Rete state that we don't want to save. For example I think every node has a `nodeValue` in its state. This is a not a property that we save in the node configuration.

I'm not sure if the `nodeValues` are saved at all.
