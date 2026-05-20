# iframe Interactive Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🚧 State update lost due to debounce **[requires active interaction]**

- User A and User B both have the same iframe interactive tile open
- Pause User A's uploads
- User A makes a change that updates the model
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and interact repeatedly with the iframe content (which debounces state updates at 500ms) so the debounce timer keeps resetting when User A's change arrives
- User A's change arrives during User B's 500ms debounce window
- **Expected Result**: User B's debounced state update may overwrite User A's change, or User A's change may overwrite User B's pending state. The `currentInteractiveState` ref comparison may not detect the conflict.
- **Actual Result**:
