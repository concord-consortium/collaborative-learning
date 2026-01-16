import { removeLoadingMessage, showLoadingMessage } from "./utilities/loading-utils";
// import all tools so they are registered
import "./models/tiles/placeholder/placeholder-registration";
import "./models/tiles/unknown-content-registration";

function loggedLoad(name: string, imports: () => Promise<unknown>[]) {
  const message = "Loading tile: " + name;
  return async () => {
    showLoadingMessage(message);
    await Promise.all(imports());
    removeLoadingMessage(message);
  };
}

const gTileRegistration: Record<string, () => void> = {
  "Question": loggedLoad("Question", () => [
    import(/* webpackChunkName: "Question" */"./models/tiles/question/question-registration")
  ]),
  "AI": loggedLoad("AI", () => [
    import(/* webpackChunkName: "AI" */"./plugins/ai/ai-registration")
  ]),
  "BarGraph": loggedLoad("BarGraph", () => [
    import(/* webpackChunkName: "BarGraph" */"./plugins/bar-graph/bar-graph-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "DataCard": loggedLoad("DataCard", () => [
    import(/* webpackChunkName: "DataCard" */"./plugins/data-card/data-card-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Dataflow": loggedLoad("Dataflow", () => [
    import(/* webpackChunkName: "Dataflow" */"./plugins/dataflow/dataflow-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration"),
    import(/* webpackChunkName: "SharedProgramData" */"./models/shared/shared-program-data-registration")
  ]),
  "Diagram": loggedLoad("Diagram", () => [
    import(/* webpackChunkName: "Diagram" */"./plugins/diagram-viewer/diagram-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration")
  ]),
  "Drawing": loggedLoad("Drawing", () => [
    import(/* webpackChunkName: "Drawing" */"./plugins/drawing/drawing-registration")
  ]),
  "ErrorTest": loggedLoad("ErrorTest", () => [
    import(/* webpackChunkName: "Error" */"./plugins/error-test/error-test-registration")
  ]),
  "Expression": loggedLoad("Expression", () => [
    import(/* webpackChunkName: "Expression" */"./plugins/expression/expression-registration")
  ]),
  "Geometry": loggedLoad("Geometry", () => [
    import(/* webpackChunkName: "Geometry" */"./models/tiles/geometry/geometry-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Graph": loggedLoad("Graph", () => [
    import(/* webpackChunkName: "Graph" */"./plugins/graph/graph-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration"),
    import(/* webpackChunkName: "SharedCaseMetadata" */"./models/shared/shared-case-metadata-registration")
  ]),
  "Image": loggedLoad("Image", () => [
    import(/* webpackChunkName: "Image" */"./models/tiles/image/image-registration")
  ]),
  "InteractiveApi": loggedLoad("InteractiveApi", () => [
    import(/* webpackChunkName: "InteractiveApi" */"./plugins/interactive-api/interactive-api-tile-registration")
  ]),
  "Numberline": loggedLoad("Numberline", () => [
    import(/* webpackChunkName: "Numberline" */"./plugins/numberline/numberline-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Simulator": loggedLoad("Simulator", () => [
    import(/* webpackChunkName: "Simulator" */"./plugins/simulator/simulator-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration")
  ]),
  "Starter": loggedLoad("Starter", () => [
    import(/* webpackChunkName: "Starter" */"./plugins/starter/starter-registration")
  ]),
  "Table": loggedLoad("Table", () => [
    import(/* webpackChunkName: "Table" */"./models/tiles/table/table-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Text": loggedLoad("Text", () => [
    import(/* webpackChunkName: "Text" */"./models/tiles/text/text-registration")
  ])
};

export function registerTileTypes(tileTypeIds: string[]) {
  return Promise.all(tileTypeIds.map(id => gTileRegistration[id]?.()));
}
