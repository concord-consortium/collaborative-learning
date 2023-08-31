// import all tools so they are registered
import "./models/tiles/placeholder/placeholder-registration";
import "./models/tiles/unknown-content-registration";

const gTileRegistration: Record<string, () => void> = {
  "DataCard": () => Promise.all([
    import(/* webpackChunkName: "DataCard" */"./plugins/data-card/data-card-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Dataflow": () => Promise.all([
    import(/* webpackChunkName: "Dataflow" */"./plugins/dataflow/dataflow-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Diagram": () => Promise.all([
    import(/* webpackChunkName: "Diagram" */"./plugins/diagram-viewer/diagram-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration")
  ]),
  "Drawing": () => import(/* webpackChunkName: "Drawing" */"./plugins/drawing/drawing-registration"),
  "Expression": () => import(/* webpackChunkName: "Expression" */"./plugins/expression/expression-registration"),
  "Geometry": () => Promise.all([
    import(/* webpackChunkName: "Geometry" */"./models/tiles/geometry/geometry-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Graph": () => Promise.all([
    import(/* webpackChunkName: "Graph" */"./plugins/graph/graph-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration"),
    import(/* webpackChunkName: "SharedCaseMetadata" */"./models/shared/shared-case-metadata-registration")
  ]),
  "Image": () => import(/* webpackChunkName: "Image" */"./models/tiles/image/image-registration"),
  "Numberline": () => Promise.all([
    import(/* webpackChunkName: "Numberline" */"./plugins/numberline/numberline-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),

  "Simulator": () => Promise.all([
    import(/* webpackChunkName: "Simulator" */"./plugins/simulator/simulator-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration")
  ]),
  "Starter": () => import(/* webpackChunkName: "Starter" */"./plugins/starter/starter-registration"),
  "Table": () => Promise.all([
    import(/* webpackChunkName: "Table" */"./models/tiles/table/table-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Text": () => import(/* webpackChunkName: "Text" */"./models/tiles/text/text-registration")
};

export function registerTileTypes(tileTypeIds: string[]) {
  return Promise.all(tileTypeIds.map(id => gTileRegistration[id]?.()));
}
