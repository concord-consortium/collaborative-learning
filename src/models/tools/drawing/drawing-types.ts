import { DrawingObjectDataType, Point } from "./drawing-objects";

export const kDrawingToolID = "Drawing";

export const kDrawingDefaultHeight = 180;

export type ToolbarModalButton = "select" | "line" | "vector" | "rectangle" | "ellipse" | "stamp";

export interface ToolbarSettings {
  stroke: string;
  fill: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export const DefaultToolbarSettings: ToolbarSettings = {
  stroke: "#000000",
  fill: "none",
  strokeDashArray: "",
  strokeWidth: 2
};

export type DrawingToolChangeAction = "create" | "move" | "update" | "delete" ;

export type DrawingToolMove = Array<{id: string, destination: Point}>;
export interface DrawingToolUpdate {
  ids: string[];
  update: {
    prop: string;
    newValue: string|number;
  };
}
export type DrawingToolDeletion = string[];

export interface DrawingToolChange {
  action: DrawingToolChangeAction;
  data: DrawingObjectDataType | DrawingToolMove | DrawingToolUpdate | DrawingToolDeletion;
}
