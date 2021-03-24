import { castArray } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";
import { gImageMap } from "../../image-map";
import { kAxisBuffer } from "./jxg-board";
import { JXGChange, JXGCoordPair, JXGProperties, JXGStringPair } from "./jxg-changes";
import {
  kGeometryDefaultAxisMin, kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth, toObj
} from "./jxg-types";

interface IBoardImportProps {
  axisNames?: JXGStringPair;
  axisLabels?: JXGStringPair;
  axisMin?: JXGCoordPair;
  axisRange?: JXGCoordPair;
  [prop: string]: any;
}
interface IBoardImportSpec {
  properties?: IBoardImportProps;
}

interface ICommentProps {
  text?: string;
  [prop: string]: any;
}

interface IPointImportSpec {
  type: "point";
  parents: [number, number];
  properties?: Record<string, unknown>;
  comment?: ICommentProps;
}

interface IVertexImportSpec extends IPointImportSpec {
  angleLabel?: boolean;
}

interface IPolygonImportSpec {
  type: "polygon";
  parents: IVertexImportSpec[];
  properties?: Record<string, unknown>;
  comment?: ICommentProps;
}

interface IImageImportSpec {
  type: "image";
  parents: {
    url: string;
    coords: JXGCoordPair;
    size: JXGCoordPair;
  };
  properties?: Record<string, unknown>;
  comment?: ICommentProps;
}

interface IMovableLineImportSpec {
  type: "movableLine";
  parents: [IPointImportSpec, IPointImportSpec];
  properties?: Record<string, unknown>;
  comment?: ICommentProps;
}

type IObjectImportSpec = IPointImportSpec | IPolygonImportSpec | IImageImportSpec | IMovableLineImportSpec;

interface IImportSpec {
  title?: string;
  board: IBoardImportSpec;
  objects: IObjectImportSpec[];
}

export const isGeometryImportSpec = (obj: any): obj is IImportSpec =>
              (obj.type === "Geometry") && (obj.changes == null) && (obj.objects != null);

function getAxisUnits(protoRange: JXGCoordPair | undefined) {
  const pRange = protoRange && castArray(protoRange);
  if (!pRange?.length) return [kGeometryDefaultPixelsPerUnit, kGeometryDefaultPixelsPerUnit];
  // a single value is treated as the y-range
  if (pRange.length === 1) {
    const [yProtoRange] = pRange;
    const yUnit = kGeometryDefaultHeight / yProtoRange;
    return [yUnit, yUnit];
  }
  else {
    const [xProtoRange, yProtoRange] = pRange as JXGCoordPair;
    return [kGeometryDefaultWidth / xProtoRange, kGeometryDefaultHeight / yProtoRange];
  }
}

function getBoardBounds(axisMin?: JXGCoordPair, protoRange?: JXGCoordPair) {
  const [xAxisMin, yAxisMin] = axisMin || [kGeometryDefaultAxisMin, kGeometryDefaultAxisMin];
  const [xPixelsPerUnit, yPixelsPerUnit] = getAxisUnits(protoRange);
  const xAxisMax = xAxisMin + kGeometryDefaultWidth / xPixelsPerUnit;
  const yAxisMax = yAxisMin + kGeometryDefaultHeight / yPixelsPerUnit;
  return [xAxisMin, yAxisMax, xAxisMax, yAxisMin];
}

export function defaultGeometryBoardChange(overrides?: JXGProperties) {
  const [xMin, yMax, xMax, yMin] = getBoardBounds();
  const unitX = kGeometryDefaultPixelsPerUnit;
  const unitY = kGeometryDefaultPixelsPerUnit;
  const xBufferRange = kAxisBuffer / unitX;
  const yBufferRange = kAxisBuffer / unitY;
  const boundingBox = [xMin - (xBufferRange * 2), yMax + yBufferRange, xMax + xBufferRange, yMin - yBufferRange];
  const change: JXGChange = {
    operation: "create",
    target: "board",
    properties: {
                  axis: true,
                  boundingBox,
                  unitX,
                  unitY,
                  ...overrides
                }
  };
  return change;
}

export function preprocessImportFormat(snapshot: any) {
  if (!isGeometryImportSpec(snapshot)) return snapshot;

  const { title, board: boardSpecs, objects: objectSpecs } = snapshot;
  const changes: JXGChange[] = [];

  if (title) {
    changes.push({ operation: "update", target: "metadata", properties: { title } });
  }

  function addBoard(boardSpec: IBoardImportSpec) {
    const { properties } = boardSpec || {} as IBoardImportSpec;
    const { axisNames, axisLabels, axisMin, axisRange, ...others } = properties || {} as IBoardImportProps;
    const boundingBox = getBoardBounds(axisMin, axisRange);
    const [unitX, unitY] = getAxisUnits(axisRange);
    changes.push(defaultGeometryBoardChange({
                  unitX, unitY,
                  ...toObj("xName", axisNames?.[0]), ...toObj("yName", axisNames?.[1]),
                  ...toObj("xAnnotation", axisLabels?.[0]), ...toObj("yAnnotation", axisLabels?.[1]),
                  boundingBox, ...others }));
  }

  addBoard(boardSpecs);

  function addComment(props: Record<string, unknown>) {
    const id = uniqueId();
    changes.push({ operation: "create", target: "comment", properties: {id, ...props }});
    return id;
  }

  function addPoint(pointSpec: IPointImportSpec) {
    const { type, properties: _properties, ...others } = pointSpec;
    const id = uniqueId();
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "point", properties, ...others });
    if (pointSpec.comment) {
      addComment({ anchor: id, ...pointSpec.comment });
    }
    return id;
  }

  function addPolygon(polygonSpec: IPolygonImportSpec) {
    const { parents: parentSpecs, properties: _properties } = polygonSpec;
    const id = uniqueId();
    const vertices: Array<{ id: string, angleLabel?: boolean }> = [];
    const parents = parentSpecs.map(spec => {
                      const ptId = addPoint(spec);
                      vertices.push({ id: ptId, angleLabel: spec.angleLabel });
                      return ptId;
                    });
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "polygon", parents, properties });
    const lastIndex = vertices.length - 1;
    vertices.forEach((pt, i) => {
      let angleParents;
      if (pt.angleLabel) {
        const prev = i === 0 ? vertices[lastIndex].id : vertices[i - 1].id;
        const self = vertices[i].id;
        const next = i === lastIndex ? vertices[0].id : vertices[i + 1].id;
        angleParents = [prev, self, next];
        changes.push({ operation: "create", target: "vertexAngle", parents: angleParents });
      }
    });
    if (polygonSpec.comment) {
      addComment({ anchor: id, ...polygonSpec.comment });
    }
    return id;
  }

  function addImage(imageSpec: IImageImportSpec) {
    const { type, parents: _parents, properties: _properties, ...others } = imageSpec;
    const { url, coords, size: pxSize } = _parents;
    const size = pxSize.map(s => s / kGeometryDefaultPixelsPerUnit) as JXGCoordPair;
    const parents = [url, coords, size];
    const id = uniqueId();
    const properties = { id, ..._properties };
    gImageMap.getImage(url);  // register with image map
    changes.push({ operation: "create", target: "image", parents, properties, ...others });
    if (imageSpec.comment) {
      addComment({ anchor: id, ...imageSpec.comment });
    }
    return id;
  }

  function addMovableLine(movableLineSpec: IMovableLineImportSpec) {
    const { type, parents: _parents, properties: _properties, ...others } = movableLineSpec;
    const id = uniqueId();
    const [pt1Spec, pt2Spec] = _parents;
    const parents = _parents.map(ptSpec => ptSpec.parents);
    const properties = { id, pt1: pt1Spec.properties, pt2: pt2Spec.properties, ..._properties };
    changes.push({ operation: "create", target: "movableLine", parents, properties, ...others });
    if (movableLineSpec.comment) {
      addComment({ anchor: id, ...movableLineSpec.comment });
    }
    return id;
  }

  objectSpecs.forEach(spec => {
    switch (spec.type) {
      case "point":
        addPoint(spec);
        break;
      case "polygon":
        addPolygon(spec);
        break;
      case "image":
        addImage(spec);
        break;
      case "movableLine":
        addMovableLine(spec);
        break;
    }
  });

  return {
    type: "Geometry",
    changes: changes.map(change => JSON.stringify(change))
  };
}
