import { TileHandlerParams } from "../ai-summarizer-types";
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
        result += `${oneDatasetWord} is the "${dataSet.name}" (${dataSet.id}) data set.`;
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
