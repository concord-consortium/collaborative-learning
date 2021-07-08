import { castArray } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";
import { gImageMap } from "../../image-map";
import { kAxisBuffer } from "./jxg-board";
import { JXGChange, JXGCoordPair, JXGProperties, JXGStringPair } from "./jxg-changes";
import {
  kGeometryDefaultAxisMin, kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth, toObj
} from "./jxg-types";

/****
  The original geometry import format was designed to simplify the process of hand-authoring content.
  As such, it used a nested structure to obviate the need for the user to specify unique element ids.
  For instance, the specification of a triangle with a vertex angle would be:
  {
    type: "polygon",
    parents: [
      { type: "point", parents: [0, 0], angleLabel: true },
      { type: "point", parents: [5, 0] },
      { type: "point", parents: [0, 5] }
    ]
  }

  Internally, the import code converts this to code that creates three points with unique ids and
  then creates a polygon that references those three points as dependencies by their unique ids,
  and then creates a vertex angle that references those same three points in the same manner.
  An advantage of this format is that by eliminating the need for ids, authors are not required
  to (1) generate unique ids for every element in the geometry and (2) correctly reference those
  unique ids in the creation of new elements, remembering to update any references when an id is
  changed, etc. This would clearly be an error-prone process.

  A disadvantage of this nested import structure is that it's harder to generate programmatically,
  and if ids are always randomly generated on import then a round trip export/import won't result
  in the same content because all of the ids will have changed.

  For these reasons, with the advent of programmatic export we now also support an alternative
  import format which is flat rather than nested. In the flat format, the specification of a
  triangle with a vertex angle looks like this:
  [
    { type: "point", parents: [0, 0], properties: { id: "point-1-id" } },
    { type: "point", parents: [5, 0], properties: { id: "point-2-id" } },
    { type: "point", parents: [0, 5], properties: { id: "point-3-id" } },
    { type: "polygon", parents: ["point-1-id", "point-2-id", "point-3-id"], properties: { id: "polygon-1-id" } },
    { type: "vertexAngle", parents: ["point-2-id", "point-1-id", "point-3-id"], properties: { id: "angle-1-id" } }
  ]

  While there is nothing to prevent a user from hand-editing this format, it is designed to be
  generated programmatically such that the ids are guaranteed to be internally unique and
  correctly self-referential. The results are undefined if a user were to hand-edit individual
  ids in an inconsistent manner, for instance.
 ****/

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
  parents?: JXGCoordPair;
  [prop: string]: any;
}

interface ICommentImportSpec {
  type: "comment";
  parents?: JXGCoordPair;
  properties: {
    text?: string;
    anchor: string;
    [prop: string]: any;
  }
}

interface IPointImportSpec {
  type: "point";
  parents: JXGCoordPair;
  properties?: Record<string, unknown>;
  comment?: ICommentProps;
}

interface IVertexImportSpec extends IPointImportSpec {
  angleLabel?: boolean;
}

interface IPolygonImportSpec {
  type: "polygon";
  parents: Array<IVertexImportSpec | string>;
  properties?: Record<string, unknown>;
  comment?: ICommentProps;
}

interface IVertexAngleImportSpec {
  type: "vertexAngle",
  parents: [string, string, string];
  properties?: Record<string, unknown>;
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

type IObjectImportSpec = IPointImportSpec | IPolygonImportSpec | IVertexAngleImportSpec |
                          ICommentImportSpec | IImageImportSpec | IMovableLineImportSpec;

interface IImportSpec {
  title?: string;
  board: IBoardImportSpec;
  objects: IObjectImportSpec[];
}

export const isGeometryImportSpec = (obj: any): obj is IImportSpec =>
              (obj?.type === "Geometry") && (obj.changes == null) && (obj.objects != null);

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

  function addCommentFromProps(props: ICommentProps) {
    const { parents, ...others } = props;
    const id = uniqueId();
    changes.push({ operation: "create", target: "comment", parents, properties: { id, ...others } });
    return id;
  }

  function addCommentFromSpec(spec: ICommentImportSpec) {
    const { parents, properties } = spec;
    return addCommentFromProps({ ...properties, parents });
  }

  function addPoint(pointSpec: IPointImportSpec) {
    const { type, properties: _properties, comment, ...others } = pointSpec;
    const id = uniqueId();
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "point", properties, ...others });
    if (comment) {
      addCommentFromProps({ anchor: id, ...comment });
    }
    return id;
  }

  function addPolygon(polygonSpec: IPolygonImportSpec) {
    const { parents: parentSpecs, properties: _properties, comment } = polygonSpec;
    const id = uniqueId();
    const vertices: Array<{ id: string, angleLabel?: boolean }> = [];
    const parents = parentSpecs.map(spec => {
                      const ptId = typeof spec === "string" ? spec : addPoint(spec);
                      const angleLabel = (typeof spec === "object") && !!spec.angleLabel;
                      vertices.push({ id: ptId, angleLabel });
                      return ptId;
                    });
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "polygon", parents, properties });
    const lastIndex = vertices.length - 1;
    vertices.forEach((pt, i) => {
      let angleParents: [string, string, string];
      if (pt.angleLabel) {
        const prev = i === 0 ? vertices[lastIndex].id : vertices[i - 1].id;
        const self = vertices[i].id;
        const next = i === lastIndex ? vertices[0].id : vertices[i + 1].id;
        angleParents = [prev, self, next];
        addVertexAngle({ type: "vertexAngle", parents: angleParents });
      }
    });
    if (comment) {
      addCommentFromProps({ anchor: id, ...comment });
    }
    return id;
  }

  function addVertexAngle(angleSpec: IVertexAngleImportSpec) {
    const { type, parents, properties: _properties, ...others } = angleSpec;
    const id = uniqueId();
    const properties = { id, ..._properties };
    changes.push({ operation: "create", target: "vertexAngle", parents, properties, ...others });
  }

  function addImage(imageSpec: IImageImportSpec) {
    const { type, parents: _parents, properties: _properties, comment, ...others } = imageSpec;
    const { url, coords, size: pxSize } = _parents;
    const size = pxSize.map(s => s / kGeometryDefaultPixelsPerUnit) as JXGCoordPair;
    const parents = [url, coords, size];
    const id = uniqueId();
    const properties = { id, ..._properties };
    gImageMap.getImage(url);  // register with image map
    changes.push({ operation: "create", target: "image", parents, properties, ...others });
    if (comment) {
      addCommentFromProps({ anchor: id, ...comment });
    }
    return id;
  }

  function addMovableLine(movableLineSpec: IMovableLineImportSpec) {
    const { type, parents: _parents, properties: _properties, comment, ...others } = movableLineSpec;
    const id = uniqueId();
    const [pt1Spec, pt2Spec] = _parents;
    const parents = _parents.map(ptSpec => ptSpec.parents);
    const properties = { id, pt1: pt1Spec.properties, pt2: pt2Spec.properties, ..._properties };
    changes.push({ operation: "create", target: "movableLine", parents, properties, ...others });
    if (comment) {
      addCommentFromProps({ anchor: id, ...comment });
    }
    return id;
  }

  objectSpecs.forEach(spec => {
    switch (spec.type) {
      case "comment":
        addCommentFromSpec(spec);
        break;
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
      case "vertexAngle":
        addVertexAngle(spec);
        break;
    }
  });

  return {
    type: "Geometry",
    changes: changes.map(change => JSON.stringify(change))
  };
}
