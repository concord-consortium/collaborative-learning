Development Guidelines

- Node `data` functions should not modify MST state. These functions will be called even on readonly views of the DataFlow tile. This can be used to update volatile or computed information that is based on a node's inputs and outputs.
- The `process` function should not modify MST state. Same as above
- The `tick` function can modify MST state, it should only be called when the tile is writable.
