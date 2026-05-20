# AI Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🚧 Prompt overwritten during typing **[requires active interaction]**

- User A and User B both have the same AI tile open
- Pause User A's uploads
- User A submits a prompt (which updates the model)
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start typing a prompt in the AI tile's textarea
- User A's change arrives mid-typing
- **Expected Result**: Since the textarea is bound to `content.prompt`, a remote change to the prompt would overwrite User B's in-progress text.
- **Actual Result**:
