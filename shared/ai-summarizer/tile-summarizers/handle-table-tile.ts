import { TileHandlerParams } from "../ai-summarizer-types";

export function handleTableTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Table") { return undefined; }
  let result = `This tile contains a table`;
  if (tile.sharedDataSet) {
    result += ` which uses the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
  }
  return result;
}
