# Undo and Time Travel for Tile Developers

When a tile is used in a CLUE document, the history of changes to that tile's content model are recorded by the history framework. The details of the implementation of the framework are described in [history-framework.md](./history-framework.md). These history entries are used to support undo and time traveling.

The history entries are based on the actions called on the tile's content model. If one action (the parent) calls another action (a child), a single entry is recorded with the name of the parent action.  This single entry has the changes from the parent and child actions.

## withoutUndo

If you want an action to be part of the time travel history, but not part of the undo stack you can use `withoutUndo()`. 

The convention is to call this at the top of an action like this:

```
actions(self => {
  doSomething() {
    withoutUndo();
    // make some changes to self or its children
  }
})
```

Currently if you add `withoutUndo` to an action and then you call this action from another action, the `withoutUndo` will be ignored. A warning message will be printed in this case describing how we can change the code to handle this. You can see that in [tree-monitor.ts](../src/models/history/tree-monitor.ts#L306)

## Grouping Changes

You will want to group changes into a single entry in some cases. Otherwise a user will have to undo multiple times when they'd expect to only undo once.

There are currently 2 ways to group changes:
- use a parent action
- use a MST `flow`

### Parent Action

The parent action approach was described above. To repeat: any action that calls another (child) action creates a single entry for the parent action.  If you have an event handler in a component which calls two actions on a model, this would result in two separate history entries. Instead you should create a single action in the model which calls these two actions.  This has [benefits beyond undo and time travel](https://mobx.js.org/actions.html#:~:text=to%20leverage%20the%20transactional%20nature%20of%20mobx%20as%20much%20as%20possible).

### MST Flow

MST provides a `flow` utility to support asynchronous actions. Changes made in the flow and actions called by the flow will be grouped together into a single entry. This can be useful when an initial action triggers a network request and the result changes the model. This way the "extra" change is grouped with the first and doesn't result in an extra history entry that wouldn't make sense to the user when undo'ing. 

`flow` can also be used for things like dragging events. The flow can be started by the mouse down event and then it waits for a promise that will be resolved when the mouse up event happens. The actions or model changes that happen within the flow will be recorded as part of the parent action.  Things that happen in async actions that are waited for by the flow will also be part of the parent flow. Things that happen in non-action promises the flow is waiting for will not be recorded as part of the parent flow.
