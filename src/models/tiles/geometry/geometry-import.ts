import { castArray } from "lodash";
import { getChildType, IAnyStateTreeNode } from "mobx-state-tree";
import { uniqueId } from "../../../utilities/js-utils";
import { gImageMap } from "../../image-map";
import { convertChangesToModel, isGeometryChangesContent } from "./geometry-migrate";
import {
  AxisModelSnapshot, AxisModelType, BoardModel, CommentModel, GeometryExtrasContentSnapshotType,
  GeometryObjectModelType, ImageModel, ImageModelType, MovableLineModel, PointModel, PolygonModel, VertexAngleModel
} from "./geometry-model";
import { kDefaultBoardModelInputProps } from "./geometry-types";
import { kAxisBuffer, kXAxisMinBuffer } from "./jxg-board";
import { JXGChange, JXGCoordPair, JXGProperties, JXGStringPair } from "./jxg-changes";
import {
  kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin, kGeometryDefaultHeight,
  kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth
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
  and then creates a vertex angle that references those same three points in the same manner. An
  advantage of this import format is that by eliminating the need for ids, authors are not required
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

interface ICommentImportProps {
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
  comment?: ICommentImportProps;
}

interface IVertexImportSpec extends IPointImportSpec {
  angleLabel?: boolean;
}

interface IPolygonImportSpec {
  type: "polygon";
  parents: Array<IVertexImportSpec | string>;
  properties?: Record<string, unknown>;
  comment?: ICommentImportProps;
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
  comment?: ICommentImportProps;
}

interface IMovableLineImportSpec {
  type: "movableLine";
  parents: [IPointImportSpec, IPointImportSpec];
  properties?: Record<string, unknown>;
  comment?: ICommentImportProps;
}

type IObjectImportSpec = IPointImportSpec | IPolygonImportSpec | IVertexAngleImportSpec |
                          ICommentImportSpec | IImageImportSpec | IMovableLineImportSpec;

interface IImportSpec {
  title?: string;
  board: IBoardImportSpec;
  objects: IObjectImportSpec[];
}

export const isGeometryImportSpec = (snap: any): snap is IImportSpec => {
  if ((snap?.type !== "Geometry") || (snap.changes != null) || (snap.objects == null)) return false;
  // does it have a legacy title?
  if (snap.title) return true;
  // does it have a legacy/import board spec?
  const board = snap.board || {};
  if ("properties" in board) return true;
  // are there legacy/import object specs?
  const objects = Array.isArray(snap.objects) ? snap.objects : [];
  return objects.some((obj: any) => "parents" in obj);
};

type AxisTuple = [AxisModelSnapshot, AxisModelSnapshot];
function getBaseAxes(protoMin?: JXGCoordPair, protoRange?: JXGCoordPair): AxisTuple {
  const [xMin, yMin] = protoMin || [kGeometryDefaultXAxisMin, kGeometryDefaultYAxisMin];
  const pRange = protoRange ? castArray(protoRange) : [];

  switch (pRange.length) {
    case 0:
      return [{ min: xMin }, { min: yMin }];
    case 1: {
      // a single value is treated as the y-range
      const [yRange] = pRange;
      const yUnit = kGeometryDefaultHeight / yRange;
      const xRange = kGeometryDefaultWidth / yUnit;
      return [{ min: xMin, unit: yUnit, range: xRange }, { min: yMin, unit: yUnit, range: yRange }];
    }
    default: {
      const [xRange, yRange] = pRange as JXGCoordPair;
      const xUnit = kGeometryDefaultWidth / xRange;
      const yUnit = kGeometryDefaultHeight / yRange;
      return [{ min: xMin, unit: xUnit, range: xRange }, { min: yMin, unit: yUnit, range: yRange }];
    }
  }
}

function getBoardBounds(axisMin?: JXGCoordPair, protoRange?: JXGCoordPair) {
  const [xAxis, yAxis] = getBaseAxes(axisMin, protoRange);
  const xAxisMax = xAxis.min + kGeometryDefaultWidth / (xAxis.unit ?? kGeometryDefaultPixelsPerUnit);
  const yAxisMax = yAxis.min + kGeometryDefaultHeight / (yAxis.unit ?? kGeometryDefaultPixelsPerUnit);
  return [xAxis.min, yAxisMax, xAxisMax, yAxis.min];
}

export interface IGeometryBoardChangeOptions {
  addBuffers?: boolean;
  includeUnits?: boolean;
}
export function defaultGeometryBoardChange(
  xAxis: AxisModelType, yAxis: AxisModelType, overrides?: JXGProperties, options?: IGeometryBoardChangeOptions
) {
  const { addBuffers, includeUnits } = options ?? {};
  const axisMin: JXGCoordPair = [xAxis.min, yAxis.min];
  const axisRange: JXGCoordPair = [xAxis.range ?? kGeometryDefaultWidth / xAxis.unit,
                                   yAxis.range ?? kGeometryDefaultHeight / yAxis.unit];
  const [xMin, yMax, xMax, yMin] = getBoardBounds(axisMin, axisRange);
  const unitX = xAxis.unit || kGeometryDefaultPixelsPerUnit;
  const unitY = yAxis.unit || kGeometryDefaultPixelsPerUnit;
  const xMinBufferRange = addBuffers ? kXAxisMinBuffer / unitX : 0;
  const xMaxBufferRange = addBuffers ? kAxisBuffer / unitX : 0;
  const yBufferRange = addBuffers ? kAxisBuffer / unitY : 0;
  const boundingBox = [xMin - xMinBufferRange, yMax + yBufferRange, xMax + xMaxBufferRange, yMin - yBufferRange];
  const units = includeUnits ? { unitX, unitY } : {};
  const change: JXGChange = {
    operation: "create",
    target: "board",
    properties: {
      boundingBox,
      ...units,
      ...overrides
    }
  };
  return change;
}

export function preprocessImportFormat(snapshot: any): GeometryExtrasContentSnapshotType {
  if (isGeometryChangesContent(snapshot)) return convertChangesToModel(snapshot.changes);
  if (!isGeometryImportSpec(snapshot)) return snapshot;

  const { title, board: boardSpecs, objects: objectSpecs } = snapshot;
  let board = BoardModel.create(kDefaultBoardModelInputProps);
  let bgImage: ImageModelType | undefined;
  const objects = new Map<string, GeometryObjectModelType>();
  const extras = title ? { title } : undefined;

  const addObject = (obj: GeometryObjectModelType) => {
    objects.set(obj.id, obj);
    return obj;
  };

  // This function is used to identify imported properties that are not handled by the import process.
  // They could be authoring errors (e.g. typos) or bugs that indicate properties that should be handled.
  function warnExtraProps(label: string, object: IAnyStateTreeNode, ...others: Array<Record<string, any>>) {
    const extraProps: Record<string, string> = {};
    others.forEach(props => {
      Object.keys(props).forEach(prop => {
        if (prop !== prop.trim()) console.error("warnExtraProps:", `"${prop}" !== "${prop.trim()}"`);
        if (!getChildType(object, prop.trim())) {
          extraProps[prop.trim()] = JSON.stringify(props[prop]);
        }
      });
    });
    Object.keys(extraProps).length &&
      console.warn(`preprocessImportFormat.${label}`, "extraProps:", JSON.stringify(extraProps));
  }

  function addBoard(boardSpec: IBoardImportSpec) {
    const { properties } = boardSpec || {} as IBoardImportSpec;
    const { axisNames, axisLabels, axisMin, axisRange, ...others } = properties || {} as IBoardImportProps;
    const [xAxisBase, yAxisBase] = getBaseAxes(axisMin, axisRange);
    board = BoardModel.create({
      xAxis: { ...xAxisBase, name: axisNames?.[0], label: axisLabels?.[0] },
      yAxis: { ...yAxisBase, name: axisNames?.[1], label: axisLabels?.[1] },
      ...others
    });
  }

  addBoard(boardSpecs);

  function addCommentFromProps(props: ICommentImportProps) {
    const { parents, id = uniqueId(), anchor, text, ...others } = props;
    const o = addObject(CommentModel.create({ id, x: parents?.[0], y: parents?.[1], anchors: [anchor], text }));
    warnExtraProps("addCommentFromProps", o, others);
    return id as string;
  }

  function addCommentFromSpec(spec: ICommentImportSpec) {
    const { parents, properties } = spec;
    return addCommentFromProps({ ...properties, parents });
  }

  function addPoint(spec: IPointImportSpec) {
    const { type, parents, properties: { id = uniqueId(), ...otherProps } = {}, comment, ...others } = spec;
    const [x, y] = parents;
    const o = addObject(PointModel.create({ id: id as string, x, y, ...otherProps, ...others }));
    warnExtraProps("addPoint", o, otherProps, others);
    if (comment) {
      addCommentFromProps({ anchor: id, ...comment });
    }
    return id as string;
  }

  function addVertex(spec: IVertexImportSpec) {
    const { angleLabel, ...others } = spec;
    return addPoint(others);
  }

  function addPolygon(polySpec: IPolygonImportSpec) {
    const { type, parents, properties: { id = uniqueId(), ...otherProps } = {}, comment, ...others } = polySpec;
    const vertices: Array<{ id: string, angleLabel?: boolean }> = [];
    const points = parents.map(ptSpec => {
      const ptId = typeof ptSpec === "string" ? ptSpec : addVertex(ptSpec);
      const angleLabel = (typeof ptSpec === "object") && !!ptSpec.angleLabel;
      vertices.push({ id: ptId, angleLabel });
      return ptId;
    });
    // TODO: handle labelOption
    const o = addObject(PolygonModel.create({ id: id as string, points, ...otherProps, ...others }));
    warnExtraProps("addPolygon", o, otherProps, others);

    // add any embedded vertex angles
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
    const { type, parents, properties: { id = uniqueId(), ...otherProps } = {}, ...others } = angleSpec;
    const o = addObject(VertexAngleModel.create({ id: id as string, points: parents, ...otherProps, ...others }));
    warnExtraProps("addVertexAngle", o, otherProps, others);
    return id as string;
  }

  function addImage(spec: IImageImportSpec) {
    const { type, parents, properties: { id = uniqueId(), ...otherProps } = {}, comment, ...others } = spec;
    const { url, coords: [x, y], size: pxSize } = parents;
    const [width, height] = pxSize.map(s => s / kGeometryDefaultPixelsPerUnit);
    gImageMap.getImage(url);  // register with image map
    // for now, only a single image can be used as a background image
    bgImage = ImageModel.create({ id: id as string, x, y, width, height, url, ...otherProps, ...others });
    warnExtraProps("addImage", bgImage, otherProps, others);
    if (comment) {
      addCommentFromProps({ anchor: id as string, ...comment });
    }
    return id as string;
  }

  function addMovableLine(spec: IMovableLineImportSpec) {
    const { type, parents, properties: { id = uniqueId(), pt1, pt2, ...otherProps } = {}, comment, ...others } = spec;
    const [pt1Spec, pt2Spec] = parents;
    const [p1x, p1y] = pt1Spec.parents;
    const [p2x, p2y] = pt2Spec.parents;
    const p1 = { x: p1x, y: p1y, ...pt1 as object, id: `${id}-point1` };
    const p2 = { x: p2x, y: p2y, ...pt2 as object, id: `${id}-point2` };
    const o = addObject(MovableLineModel.create({ id: id as string, p1, p2, ...otherProps, ...others }));
    warnExtraProps("addMovableLine", o, otherProps, others);
    if (comment) {
      addCommentFromProps({ anchor: id, ...comment });
    }
    return id as string;
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

  return { type: "Geometry", board, bgImage, objects: Object.fromEntries(objects), extras };
}
