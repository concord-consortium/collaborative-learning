import { brainwavesGripperData } from "../../simulations/brainwaves-gripper/brainwaves-gripper";
import { TileHandlerParams } from "../ai-summarizer-types";
import { generateMarkdownTable } from "../ai-summarizer-utils";

export function handleSimulatorTile({ tile }: TileHandlerParams) {
  if (tile.model.content.type !== "Simulator") { return undefined; }

  const simData = brainwavesGripperData;

  let result = `This tile contains a simulation, which can be described as follows:\n\n`;
  result += `${simData.description}\n\n`;

  result += `The following table includes useful information about the simulation:\n\n`;
  result += generateMarkdownTable(["Description", "Value"], Object.entries(simData.values).map(([key, value]) => [
    simData.valueDescriptions[key],
    `${value}`
  ]));

  return result;
}
