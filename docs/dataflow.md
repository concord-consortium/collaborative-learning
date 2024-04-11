Development Guidelines

- Node `data` methods should not modify MST state. These functions will be called even on readonly views of the DataFlow tile. This can be used to update volatile or computed information that is based on a node's inputs and outputs.  This rule is violated by many of the nodes when they call setNodeValue in the `data` method. It is likely that these will need to be moved to the `onTick` method in order to support readonly views.
- The `process` function should not modify MST state. Same as above
- The `onTick` function can modify MST state, it should only be called when the tile is writable.
