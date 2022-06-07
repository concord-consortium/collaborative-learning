import { uniqueId } from "../../../utilities/js-utils";
import { DrawingObjectSnapshot } from "../objects/drawing-object";

export interface IDrawingTileImportSpec {
  type: "Drawing";
  objects: DrawingObjectSnapshot[];
}

export const isDrawingTileImportSpec = (snapshot: any): snapshot is IDrawingTileImportSpec =>
              (snapshot?.type === "Drawing") && (snapshot.objects != null) && !snapshot.changes;

export const importDrawingTileSpec = (snapshot: IDrawingTileImportSpec) => {
  const changes: string[] = snapshot.objects.map(data => {
    // assign unique id if one is not provided
    return JSON.stringify({ action: "create", data: { id: uniqueId(), ...data } });
  });
  return { type: "Drawing" as const, changes };
};
