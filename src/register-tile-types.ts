// import all tools so they are registered
import "./models/tiles/placeholder/placeholder-registration";
import "./models/tiles/unknown-content-registration";

const gTileRegistration: Record<string, () => void> = {
  "DataCard": () => import(/* webpackChunkName: "DataCard" */"./plugins/data-card/data-card-registration"),
  "Dataflow": () => import(/* webpackChunkName: "Dataflow" */"./plugins/dataflow/dataflow-registration"),
  "Diagram": () => Promise.all([
    import(/* webpackChunkName: "Diagram" */"./plugins/diagram-viewer/diagram-registration"),
    import(/* webpackChunkName: "SharedVariables" */"./plugins/shared-variables/shared-variables-registration")
  ]),
  "Drawing": () => import(/* webpackChunkName: "Drawing" */"./plugins/drawing/drawing-registration"),
  "Geometry": () => Promise.all([
    import(/* webpackChunkName: "Geometry" */"./models/tiles/geometry/geometry-registration"),
    import(/* webpackChunkName: "SharedDataSet" */"./models/shared/shared-data-set-registration")
  ]),
  "Image": () => import(/* webpackChunkName: "Image" */"./models/tiles/image/image-registration"),
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
