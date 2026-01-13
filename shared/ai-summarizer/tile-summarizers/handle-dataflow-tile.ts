import { TileHandlerParams } from "../ai-summarizer-types";
import { programToGraphviz } from "./dataflow-to-graphviz";

export function handleDataflowTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Dataflow") { return undefined; }
  let result = "This tile contains a dataflow diagram.";

  if (tile.sharedDataSet) {
    result += ` This tile saves recordings to the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
  }

  if (!tile.model.content.program) return result;

  result += "\n```dot\n" + programToGraphviz(tile.model.content.program) + "\n```";
  return result;
}
