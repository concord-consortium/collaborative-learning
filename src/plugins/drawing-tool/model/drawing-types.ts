import { DrawingObjectSnapshot } from "../objects/drawing-object";
import { Point } from "./drawing-basic-types";

export const kDrawingToolID = "Drawing";

export const kDrawingDefaultHeight = 180;

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse" | "stamp" | "variable";

export type DrawingToolMove = Array<{id: string, destination: Point}>;
export interface DrawingToolUpdate {
  ids: string[];
  update: {
    prop: string;
    newValue: string|number;
  };
}
export type DrawingToolDeletion = string[];

export interface DrawingToolCreateChange {
  action: "create";
  data: DrawingObjectSnapshot;
}
export interface DrawingToolMoveChange {
  action: "move";
  data: DrawingToolMove;
}
export interface DrawingToolUpdateChange {
  action: "update";
  data: DrawingToolUpdate;
}
export interface DrawingToolDeleteChange {
  action: "delete";
  data: DrawingToolDeletion;
}
export type DrawingToolChange = DrawingToolCreateChange | DrawingToolMoveChange |
                                  DrawingToolUpdateChange | DrawingToolDeleteChange;
