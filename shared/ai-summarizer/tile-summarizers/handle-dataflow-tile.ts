import { displayNameForType } from "../../dataflow-node-types";
import { IDataflowOutputConfig, TileHandlerParams } from "../ai-summarizer-types";
import { programToGraphviz } from "./dataflow-to-graphviz";

export function handleDataflowTile({ tile }: TileHandlerParams): string|undefined {
  if (tile.model.content.type !== "Dataflow") { return undefined; }
  let result = "This tile contains a dataflow diagram.";

  if (tile.sharedDataSet) {
    result += ` This tile saves recordings to the "${tile.sharedDataSet.name}" (${tile.sharedDataSet.id}) data set.`;
  }

  // Per-unit Live Output config (mirrored onto the content by the editable tile), so the AI gives valid
  // help. Only present when the unit restricts outputs and/or puts the Servo in proportion mode.
  //
  // Block names in this prose come from the same table as the graph's identifiers, for the reason
  // the graph uses it: "Live Output" and "Logic" are internal type strings the student never sees on
  // the palette, so a summary that used them would teach the AI a vocabulary the student can't match
  // to anything on screen.
  const outputConfig = tile.model.content.outputConfig as IDataflowOutputConfig | undefined;
  if (outputConfig?.allowedOutputTypes?.length) {
    result += ` In this unit, the only ${displayNameForType("Live Output")} types available are: ` +
      `${outputConfig.allowedOutputTypes.join(", ")}.`;
  }
  if (outputConfig?.servoInputMode === "proportion") {
    result += " In this unit the Servo output accepts a value from 0 to 1 (a proportion), not 0 to 180 " +
      `degrees: 0 = no rotation, 1 = full rotation. ${displayNameForType("Logic")}-block outputs (0 or 1) ` +
      "can be wired straight to it.";
  }

  if (!tile.model.content.program) return result;

  result += "\n```dot\n" + programToGraphviz(tile.model.content.program) + "\n```";
  return result;
}
