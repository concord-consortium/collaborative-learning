import { getSimulationData } from "../../simulations/simulations";
import { TileHandlerParams } from "../ai-summarizer-types";
import { generateMarkdownTable } from "../ai-summarizer-utils";

export function handleSimulatorTile({ tile }: TileHandlerParams) {
  if (tile.model.content.type !== "Simulator") { return undefined; }

  let result = `This tile contains a simulation, which can be described as follows:\n\n`;

  const { simulation } = tile.model.content;
  const simData = getSimulationData(simulation);

  if (!simData) {
    result += `No additional information is available for this simulation type.\n\n`;
    return result;
  }

  result += `${simData.description}\n\n`;

  result += `The following table includes useful information about the simulation:\n\n`;
  result += generateMarkdownTable(
    ["Description", "Value"],
    Object.values(simData.values).map(({ description, value }) => [description || "", `${value}`])
  );

  return result;
}
