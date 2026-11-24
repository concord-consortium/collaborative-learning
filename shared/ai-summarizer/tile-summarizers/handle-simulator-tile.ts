import { getSimulationData } from "../../simulations/simulations";
import { displayNameForType } from "../../dataflow-node-types";
import { AnnotationDescriberParams, TileHandlerParams } from "../ai-summarizer-types";
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

/**
 * The simulator is the one tile whose annotatable objects are not in its own content. Its
 * mini-nodes come from SharedProgramData, whose `programNodes` is volatile and so never
 * serialized, and its pins are synthesized -- 14 a side -- rather than stored.
 *
 * A node id therefore resolves against the Dataflow program the mini-nodes mirror. Nothing of the
 * node survives that program: deleting it there removes the mini-node here, so a program that does
 * not hold the id means there is nothing in the simulation to point at. Every Dataflow tile in the
 * document is searched rather than only the bound one, which the shared model would have to say;
 * node ids are unique, so the two answers differ only for an id in no program at all.
 */
const kPinIdPattern = /^[LR](\d|1[0-3])$/;

export function describeSimulatorObject(
  { objectId, objectType, tileMap }: AnnotationDescriberParams
): string | undefined {
  if (objectType === "pin") {
    return kPinIdPattern.test(objectId) ? `pin ${objectId}` : undefined;
  }
  if (objectType !== "node") { return undefined; }

  for (const tile of Object.values(tileMap ?? {})) {
    const node = (tile as any)?.content?.program?.nodes?.[objectId];
    if (node) {
      const name = node.data?.orderedDisplayName || displayNameForType(node.name);
      return `the ${name} node, shown in the simulation`;
    }
  }
  return undefined;
}
