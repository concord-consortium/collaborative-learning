// import all tools so they are registered
import "./models/tools/unknown-content";
import "./models/tools/placeholder/placeholder-registration";

const gToolRegistration: Record<string, () => void> = {
  "Diagram": () => import(/* webpackChunkName: "Diagram" */"./plugins/diagram-viewer/diagram-registration"),
  "Drawing": () => import(/* webpackChunkName: "Drawing" */"./models/tools/drawing/drawing-registration"),
  "Geometry": () => import(/* webpackChunkName: "Geometry" */"./models/tools/geometry/geometry-registration"),
  "Image": () => import(/* webpackChunkName: "Image" */"./models/tools/image/image-registration"),
  "Table": () => import(/* webpackChunkName: "Table" */"./models/tools/table/table-registration"),
  "Text": () => import(/* webpackChunkName: "Text" */"./models/tools/text/text-registration")
};

export function registerTools(toolIds: string[]) {
  return Promise.all(toolIds.map(toolId => gToolRegistration[toolId]?.()));
}
