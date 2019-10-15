import { castArray } from "lodash";

export type JXGOperation = "create" | "update" | "delete";
export type JXGObjectType = "board" |"comment" |  "image" | "linkedPoint" | "movableLine" | "object" |
                              "point" | "polygon" | "tableLink" | "vertexAngle";

export type JXGCoordPair = [number, number];
export type JXGUnsafeCoordPair = [number?, number?];

export type JXGParentType = string | number | JXGCoordPair | JXGUnsafeCoordPair;

export interface JXGProperties {
  id?: string;
  position?: JXGUnsafeCoordPair;
  url?: string;
  xMin?: number;
  yMin?: number;
  unitX?: number;
  unitY?: number;
  [key: string]: any;
}

export interface ILinkProperties {
  id: string;
  tileIds: string[];
}

export interface JXGChange {
  operation: JXGOperation;
  target: JXGObjectType;
  targetID?: string | string[];
  parents?: JXGParentType[];
  properties?: JXGProperties | JXGProperties[];
  links?: ILinkProperties;
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

export type JXGElement = JXG.Board | JXG.Line | JXG.Point | JXG.Text;
export type JXGChangeResult = JXGElement | JXGElement[] | undefined;

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
