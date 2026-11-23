import { AnnotationDescriberParams, TileHandlerParams } from "../ai-summarizer-types";
import { decipherDotId } from "../../annotations/object-ids";
import { pluralize } from "../ai-summarizer-utils";

export function handleGraphTile({ dataSets, tile }: TileHandlerParams): string|undefined {
  const { content } = tile.model;
  if (content.type !== "Graph") { return undefined; }

  // Basic info
  let result = `This tile contains a graph.`;
  const { adornments, axes, layers, plotType, xAttributeLabel, yAttributeLabel } = content;
  result += ` The graph is rendered as a ${plotType}.`;

  // Axes
  const xAxis = axes.bottom ?? axes.top;
  if (xAxis) {
    const labelPart = xAttributeLabel ? `is labeled "${xAttributeLabel}" and ` : "";
    result += ` The x axis ${labelPart}ranges from ${xAxis.min} to ${xAxis.max}.`;
  }
  const yAxis = axes.left ?? axes.rightNumeric ?? axes.rightCat;
  if (yAxis) {
    const labelPart = yAttributeLabel ? `is labeled "${yAttributeLabel}" and ` : "";
    result += ` The y axis ${labelPart}ranges from ${yAxis.min} to ${yAxis.max}.`;
  }

  // Datasets
  const pluralDataset = pluralize(layers.length, "dataset", "datasets");
  result += `\n\nThe graph displays data from ${layers.length} ${pluralDataset}.`;
  const oneDatasetWord = pluralize(layers.length, " It", "\n\nOne");
  layers.forEach((layer: any) => {
    const { config, editable } = layer;
    if (config) {
      const dataSet = dataSets.find(ds => ds.id === config.dataset);

      if (dataSet) {
        // dataSet.name can be missing -- see NormalizedDataSet.
        const dataSetPhrase = dataSet.name
          ? `the "${dataSet.name}" (${dataSet.id}) data set`
          : `data set ${dataSet.id}`;
        result += `${oneDatasetWord} is ${dataSetPhrase}.`;
        if (editable) result += ` This dataset contains manually entered data points.`;

        const xAttributeID = config._attributeDescriptions?.x?.attributeID;
        const xVariable = dataSet.attributes.find((attr: any) => attr.id === xAttributeID);
        const xVariableName = xVariable?.name ?? "An unknown variable";
        result += ` ${xVariableName} is plotted on the x axis and`;

        const yAttributeID = config._yAttributeDescriptions?.[0]?.attributeID;
        const yVariable = dataSet.attributes.find((attr: any) => attr.id === yAttributeID);
        const yVariableName = yVariable?.name ?? "An unknown variable";
        result += ` ${yVariableName} is plotted on the y axis for this dataset.`;
      }
    }
  });

  // Movable lines
  const movableLines = adornments?.find((adornment: any) => adornment.type === "Movable Line");
  if (movableLines) {
    const lines = Object.values(movableLines.lines);
    if (lines.length > 0) {
      const existenceWord = pluralize(lines.length, "is", "are");
      const lineWord = pluralize(lines.length, "line", "lines");
      result += `\n\nThere ${existenceWord} ${lines.length} movable ${lineWord} on this graph.`;
      const oneLineWord = pluralize(lines.length, "It", "One line");
      lines.forEach((line: any) => {
        result += ` ${oneLineWord} has a slope of ${line.slope} and a y-intercept of ${line.intercept}.`;
      });
    }
  }

  // TODO: Add information about more adornments
  return result;
}

/**
 * A dot is named by the values it sits at rather than by its case id, because that is what the
 * student is looking at. The case is found by searching every data set for one holding both the
 * case and the x attribute: a graph can plot several layers, so the tile's own data set is not
 * enough to say which one a dot belongs to.
 *
 * The adornment ids come from the adornment models (`movable_line_handle:{key}:lower`,
 * `var:{xId}:{yId}`). They are parsed only as far as the phrase needs; the line key itself means
 * nothing to a reader, so it is used to look the line up and then dropped.
 */
export function describeGraphObject(
  { tile, objectId, objectType, dataSets, variables }: AnnotationDescriberParams
): string | undefined {
  switch (objectType) {
    case "dot": {
      const { caseId, xAttributeId, yAttributeId } = decipherDotId(objectId);
      if (!caseId || !xAttributeId || !yAttributeId) { return undefined; }
      const dataSet = dataSets.find(ds =>
        (ds.caseIds?.includes(caseId) ?? false) && ds.attributes.some(attr => attr.id === xAttributeId));
      const rowIndex = dataSet?.caseIds?.indexOf(caseId) ?? -1;
      const x = dataSet?.attributes.find(attr => attr.id === xAttributeId)?.values[rowIndex];
      const y = dataSet?.attributes.find(attr => attr.id === yAttributeId)?.values[rowIndex];
      if (x === undefined || y === undefined) { return undefined; }
      return `the dot at (${x}, ${y})`;
    }
    case "movable-line-handle": {
      const parts = objectId.split(":");
      const position = parts[parts.length - 1] === "upper" ? "upper" : "lower";
      const key = parts.slice(1, -1).join(":");
      return `the ${position} handle of the movable line${movableLineEquation(tile, key)}`;
    }
    case "movable-line-equation": {
      const key = objectId.split(":").slice(1).join(":");
      return `the equation of the movable line${movableLineEquation(tile, key)}`;
    }
    case "variable": {
      const match = objectId.match(/^var:{(.+)}:{(.+)}$/);
      if (!match) { return undefined; }
      const name = (id: string) => {
        const variable = variables.find(candidate => candidate.id === id);
        return variable?.displayName || variable?.name || id;
      };
      return `the plotted point for ${name(match[1])} against ${name(match[2])}`;
    }
    default:
      return undefined;
  }
}

function movableLineEquation(tile: any, lineKey: string): string {
  const adornment = tile?.content?.adornments?.find((a: any) => a.type === "Movable Line");
  const line = adornment?.lines?.[lineKey];
  if (!line || line.slope === undefined || line.intercept === undefined) { return ""; }
  const sign = line.intercept < 0 ? "-" : "+";
  return ` y = ${line.slope}x ${sign} ${Math.abs(line.intercept)}`;
}
