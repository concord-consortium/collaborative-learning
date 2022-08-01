// import all tools so they are registered
import "./models/tools/unknown-content";
import "./models/tools/placeholder/placeholder-registration";

const gToolRegistration: Record<string, () => void> = {
  "Diagram": () => {
    // Currently the Diagram Tool is the only tool using SharedVariables, so we register
    // SharedVariables whenever a there is a Diagram tool in the configuration
    import(/* webpackChunkName: "Diagram" */"./plugins/diagram-viewer/diagram-registration");
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration");
  },
  "Dataflow": () => import(/* webpackChunkName: "Dataflow" */"./plugins/dataflow-tool/dataflow-registration"),
  "Drawing": () => import(/* webpackChunkName: "Drawing" */"./plugins/drawing-tool/drawing-registration"),
  "Geometry": () => {
    import(/* webpackChunkName: "Geometry" */"./models/tools/geometry/geometry-registration");
    import(/* webpackChunkName: "SharedDataSet" */"./models/tools/shared-data-set-registration");
  },
  "Image": () => import(/* webpackChunkName: "Image" */"./models/tools/image/image-registration"),
  "Table": () => {
    import(/* webpackChunkName: "Table" */"./models/tools/table/table-registration");
    import(/* webpackChunkName: "SharedDataSet" */"./models/tools/shared-data-set-registration");
  },
  "Text": () => import(/* webpackChunkName: "Text" */"./models/tools/text/text-registration")
};

export function registerTools(toolIds: string[]) {
  return Promise.all(toolIds.map(toolId => gToolRegistration[toolId]?.()));
}
