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
      if (!graphPlots(tile, xAttributeId, yAttributeId)) { return undefined; }
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
      const line = movableLine(tile, parts.slice(1, -1).join(":"));
      if (!line) { return undefined; }
      return `the ${position} handle of the movable line${lineEquation(line)}`;
    }
    case "movable-line-equation": {
      const line = movableLine(tile, objectId.split(":").slice(1).join(":"));
      if (!line) { return undefined; }
      return `the equation of the movable line${lineEquation(line)}`;
    }
    case "variable": {
      const match = objectId.match(/^var:{(.+)}:{(.+)}$/);
      if (!match) { return undefined; }
      if (!plotsVariablePair(tile, match[1], match[2])) { return undefined; }
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

// A line the student deleted leaves its handles' ids behind in the annotation; a hidden adornment
// contributes no annotatable objects at all. Either way nothing is on the graph to point at.
function movableLine(tile: any, lineKey: string): any {
  const adornment = adornmentOfType(tile, "Movable Line");
  return adornment ? adornment.lines?.[lineKey] : undefined;
}

/**
 * The line written the way the student reads it off the graph. A vertical line serializes its
 * slope as the string "Infinity" and keeps the x-coordinate in `intercept`, and a horizontal one
 * has no x term, so both take the forms `equationString` gives them rather than y = mx + b.
 */
function lineEquation(line: any): string {
  const slope = Number(line.slope);
  const intercept = Number(line.intercept);
  if (isNaN(slope) || !isFinite(intercept)) { return ""; }
  if (!isFinite(slope)) { return ` x = ${intercept}`; }
  if (slope === 0) { return ` y = ${intercept}`; }
  const sign = intercept < 0 ? "-" : "+";
  return ` y = ${slope}x ${sign} ${Math.abs(intercept)}`;
}

/**
 * Whether the graph still plots this pair of attributes. Changing a graph's columns leaves the
 * data set, the case and the old attributes all in place, so a stale dot's values stay findable
 * long after the dot itself is gone. The client's `getDotCenter` asks for a layer that holds the x
 * attribute in some role and the y attribute among its y attributes, and so does this.
 */
function graphPlots(tile: any, xAttributeId: string, yAttributeId: string): boolean {
  const layers: any[] = tile?.content?.layers ?? [];
  return layers.some(layer => {
    const yIds = yAttributeIds(layer?.config);
    if (!yIds.includes(yAttributeId)) { return false; }
    const roleIds = Object.values(layer?.config?._attributeDescriptions ?? {})
      .map((description: any) => description?.attributeID);
    return roleIds.includes(xAttributeId) || yIds.includes(xAttributeId);
  });
}

function yAttributeIds(config: any): string[] {
  const ids = (config?._yAttributeDescriptions ?? []).map((description: any) => description?.attributeID);
  const rightNumeric = config?._attributeDescriptions?.rightNumeric?.attributeID;
  return rightNumeric ? [...ids, rightNumeric] : ids;
}

// The adornment is the only record that a pair is plotted: removing a pair, or swapping one of its
// variables, leaves the sparrow's id naming two variables the graph no longer puts a point on.
function plotsVariablePair(tile: any, xVariableId: string, yVariableId: string): boolean {
  const adornment = adornmentOfType(tile, "Plotted Variables");
  return Object.values(adornment?.plottedVariables ?? {}).some((plotted: any) =>
    plotted?.xVariableId === xVariableId && plotted?.yVariableId === yVariableId);
}

function adornmentOfType(tile: any, type: string): any {
  const adornment = tile?.content?.adornments?.find((candidate: any) => candidate.type === type);
  return adornment?.isVisible === false ? undefined : adornment;
}
