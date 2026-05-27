# Simulator Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🚧 Simulation state diverges **[requires multi-user]**

- User A and User B both have a simulator tile open
- Both simulators are running on their independent intervals
- **Expected Result**: Each simulator generates its own state updates independently. When these are synced, the simulation state flip-flops between the two users' states, creating erratic behavior.
- **Actual Result**:

*This is related to the DataFlow simulation issue addressed by [GD-20: Background Entries](../group-docs-plan.md#gd-20-background-entries-dataflow).*
