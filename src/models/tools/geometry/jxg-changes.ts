
export type JXGOperation = "create" | "update" | "delete";
export type JXGObjectType = "board" | "point";

export interface JXGObjectRef {
  type: JXGObjectType;
  id: string;
}

export type JXGParentType = JXGObjectRef | number;

export interface JXGProperties {
  [key: string]: any;
}

export interface JXGChange {
  operation: JXGOperation;
  target: JXGObjectType;
  targetID?: string | string[];
  parents?: JXGParentType[];
  properties?: JXGProperties | JXGProperties[];
}

export type JXGElement = JXG.Board | JXG.Point;
export type JXGChangeResult = JXGElement | undefined;

// for create/board the board parameter is the ID of the DOM element
// for all other changes it should be the board
export type JXGCreateHandler = (board: JXG.Board|string, change: JXGChange) => JXGChangeResult;
export type JXGUpdateHandler = (board: JXG.Board, change: JXGChange) => void;
export type JXGDeleteHandler = (board: JXG.Board, change: JXGChange) => void;

export interface JXGChangeAgent {
  create: JXGCreateHandler;
  update: JXGUpdateHandler;
  delete: JXGDeleteHandler;
}
