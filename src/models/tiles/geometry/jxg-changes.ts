import { castArray } from "lodash";
import { ILinkProperties, ITableLinkProperties } from "../table-link-types";
export { type ILinkProperties, type ITableLinkProperties };

export type JXGOperation = "create" | "update" | "delete";
export type JXGObjectType = "board" | "circle" | "comment" | "image" | "infiniteLine" | "line" |
                              "linkedPoint" | "metadata" | "movableLine" | "object" | "point" | "polygon" |
                              "segment" | "tableLink" | "vertex" | "vertexAngle";

export type JXGCoordPair = [number, number];
export type JXGNormalizedCoordPair = [1, number, number];
export type JXGUnsafeCoordPair = [number?, number?];
export type JXGPositionProperty = JXGUnsafeCoordPair | JXGNormalizedCoordPair;
export type JXGStringPair = [string?, string?];

export type JXGImageParents = [string, JXGCoordPair, JXGCoordPair];

export type JXGParentType = string | number | undefined | JXGCoordPair | JXGUnsafeCoordPair;

export enum ELabelOption {
  kNone = "none",
  kLabel = "label", // parents
  kLength = "length"
}

export interface IBoardScale {
  xMin: number;
  yMin: number;
  unitX: number;
  unitY: number;
  canvasWidth: number;
  canvasHeight: number;
  xName?: string;
  yName?: string;
  xAnnotation?: string;
  yAnnotation?: string;
}

export interface JXGProperties {
  id?: string;
  ids?: string[]; // ids of linked points in tableLink change
  labelOption?: ELabelOption;
  position?: JXGPositionProperty;
  title?: string; // metadata property
  url?: string;
  xMin?: number;
  yMin?: number;
  unitX?: number;
  unitY?: number;
  boardScale?: IBoardScale;
  [key: string]: any;
}

export interface JXGChange {
  operation: JXGOperation;
  target: JXGObjectType;
  targetID?: string | string[];
  parents?: JXGParentType[];
  properties?: JXGProperties | JXGProperties[];
  links?: ILinkProperties;
  startBatch?: boolean;
  endBatch?: boolean;
  userAction?: string;
}

export interface JXGNormalizedChange {
  operation: JXGOperation;
  target: JXGObjectType;
  targetID?: string;
  parents?: JXGParentType;
  properties?: JXGProperties;
  links?: ILinkProperties;
}

export interface IChangeContext {
  isFeatureDisabled?: (feature: string) => boolean;
}

export type JXGChangeElement = JXG.Board | JXG.GeometryElement;
export type JXGChangeResult = JXGChangeElement | JXGChangeElement[] | undefined;

// for create/board the board parameter is the ID of the DOM element
// for all other changes it should be the board
export type JXGCreateHandler = (board: JXG.Board|string, change: JXGChange,
                                context?: IChangeContext) => JXGChangeResult;
export type JXGUpdateHandler = (board: JXG.Board, change: JXGChange,
                                context?: IChangeContext) => JXGChangeResult;
export type JXGDeleteHandler = (board: JXG.Board, change: JXGChange,
                                context?: IChangeContext) => void;

export interface JXGChangeAgent {
  create: JXGCreateHandler;
  update: JXGUpdateHandler;
  delete: JXGDeleteHandler;
}

export type NormalizedChangeFn = (change: JXGNormalizedChange) => void;

export function forEachNormalizedChange(change: JXGChange, fn: NormalizedChangeFn) {
  const { operation, targetID, parents, properties, ...others } = change;
  const isArrayParents = parents && Array.isArray(parents);
  // multiple points can be created with an array of JXGCoordPair
  const isArrayArrayParents = parents && isArrayParents && Array.isArray(parents[0]);
  const isCreatePointsArray = (operation === "create") && (change.target === "point") && isArrayArrayParents;
  const isArrayProps = Array.isArray(properties);
  const isArrayCreate = isArrayParents && (isCreatePointsArray || isArrayProps);

  switch (operation) {
    case "create":
      if (isArrayCreate) {
        const cPropsArray = properties && castArray(properties);
        parents && parents.forEach((parent, index) => {
          const cProps = cPropsArray && (cPropsArray[index] || cPropsArray[0]);
          fn({ operation, targetID: cProps.id, parents: parent, properties: cProps, ...others });
        });
      }
      else {
        const props = properties && properties as JXGProperties;
        const chg: JXGChange = { ...change, targetID: props && props.id };
        fn(chg as JXGNormalizedChange);
      }
      break;
    case "update":
      if (Array.isArray(targetID)) {
        const cPropsArray = properties && castArray(properties);
        targetID.forEach((id, index) => {
          const cProps = cPropsArray && (cPropsArray[index] || cPropsArray[0]);
          fn({ operation, targetID: id, properties: cProps, ...others });
        });
      }
      else {
        fn(change as JXGNormalizedChange);
      }
      break;
  }
}
