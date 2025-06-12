import { DrawingObjectSnapshot } from "../objects/drawing-object";
import { Point } from "./drawing-basic-types";

export const kDrawingTileType = "Drawing";

// This version string is stored in the state of the tile.
// Without this version, the model will try to convert the state.
export const kDrawingStateVersion = "1.1.0";
export const kDrawingDefaultHeight = 180;
export const kDuplicateOffset = 10; // Pixels between original and duplicated object
export const kFlipOffset = 10; // Pixels between original and flipped object

export const kClosedObjectListPanelWidth = 29; // Size of the Show/Sort sidebar when closed
export const kOpenObjectListPanelWidth = 170; // Size of the Show/Sort sidebar when open

// These types are used by legacy import code in drawing-change-playback.ts
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
