import { castArray } from "lodash";
import { ITileExportOptions } from "../tile-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";
import { comma, StringBuilder } from "../../../utilities/string-builder";
import {
  BoardModel, BoardModelType, CircleModelType, CommentModel, CommentModelType, GeometryBaseContentModelType,
  GeometryExtrasContentSnapshotType, GeometryObjectModelType, ImageModel, ImageModelType,
  isPointModel, LineModel, LineModelType,
  MovableLineModel, MovableLineModelType, pointIdsFromSegmentId, PointModel, PointModelType,
  PolygonModel, PolygonModelType, PolygonSegmentLabelModelSnapshot, VertexAngleModel, VertexAngleModelType
} from "./geometry-model";
import {
  ELabelOption, JXGChange, JXGCoordPair, JXGImageParents, JXGObjectType, JXGProperties
} from "./jxg-changes";
import { getMovableLinePointIds, kGeometryDefaultHeight, kGeometryDefaultWidth } from "./jxg-types";
import { kDefaultBoardModelOutputProps, kGeometryTileType } from "./geometry-types";
import { defaultGeometryBoardChange, IGeometryBoardChangeOptions } from "./geometry-import";

export const isGeometryChangesContent = (snap: any) => {
  return (snap?.type === kGeometryTileType) && Array.isArray(snap.changes);
};

export const convertChangesToModel = (changes: JXGChange[]) => {
  let changesJson: any[];
  if (changes.length > 0 && typeof changes[0] === 'string') {
    // The changes are actually already being passed in as strings for some reason.
    changesJson = changes.map(change => change as any as string);
  } else {
    // The changes are in json format, so we need to convert them to strings
    changesJson = changes.map(change => JSON.stringify(change));
  }
  return exportGeometryModel(changesJson);
};

export const getGeometryBoardChange = (
  model: GeometryBaseContentModelType, boardOptions?: IGeometryBoardChangeOptions
): JXGChange => {
  const { xAxis, yAxis } = model.board || BoardModel.create(kDefaultBoardModelOutputProps);
  const { name: xName, label: xAnnotation } = xAxis;
  const { name: yName, label: yAnnotation } = yAxis;
  const overrides = { xName, yName, xAnnotation, yAnnotation };
  return (
    defaultGeometryBoardChange(xAxis, yAxis, overrides, boardOptions )
  );
};

export const convertModelToChanges = (model: GeometryBaseContentModelType): JXGChange[] => {
  const { bgImage, objects } = model;
  const changes: JXGChange[] = [];
  // convert the background image (if any)
  if (bgImage) {
    changes.push(...convertModelObjectToChanges(bgImage));
  }
  // convert the objects
  changes.push(...convertModelObjectsToChanges(Array.from(objects.values())));
  // identify redundant images
  const imageChangeIndices: number[] = [];
  changes.forEach((change, index) => {
    if ((change.operation === "create") && (change.target === "image")) {
      imageChangeIndices.push(index);
    }
  });
  // filter out redundant images
  if (imageChangeIndices.length > 1) {
    for (let i = imageChangeIndices.length - 2; i >= 0; --i) {
      changes.splice(imageChangeIndices[i], 1);
    }
  }
  return changes;
};

// optional properties in MST objects result in `undefined` values in snapshots,
// which can confuse JSXGraph, so we strip null/undefined properties in changes
function omitNullish(inProps: Record<string, any>) {
  const outProps: Record<string, any> = {};
  for (const prop in inProps) {
    if (inProps[prop] != null) outProps[prop] = inProps[prop];
  }
  return outProps;
}

export const convertModelObjectsToChanges = (objects: GeometryObjectModelType[]): JXGChange[] => {
  const changes: JXGChange[] = [];
  // Process points first, before objects like polygons that refer to them.
  objects.forEach(obj => {
    if (isPointModel(obj)) {
      changes.push(...convertModelObjectToChanges(obj));
    }
  });
  objects.forEach(obj => {
    if (!isPointModel(obj)) {
      changes.push(...convertModelObjectToChanges(obj));
    }
  });
  return changes;
};

export const convertModelObjectToChanges = (obj: GeometryObjectModelType): JXGChange[] => {
  const changes: JXGChange[] = [];
  switch (obj.type) {
    case "circle": {
      const { centerPoint, tangentPoint, ...props } = obj as CircleModelType;
      const properties = omitNullish(props);
      if (centerPoint && tangentPoint) {
        changes.push({ operation: "create", target: "circle", parents: [centerPoint, tangentPoint], properties });
      }
      break;
    }
    case "line": {
      const { point1, point2, ...props } = obj as LineModelType;
      const properties = omitNullish(props);
      if (properties.labelOption) {
        properties.clientLabelOption = properties.labelOption;
        properties.labelOption = undefined;
      }
      if (properties.name) {
        properties.clientName = properties.name;
        properties.name = undefined;
      }
      if (point1 && point2) {
        changes.push({ operation: "create", target: "line", parents: [point1, point2], properties });
      }
      break;
    }
    case "comment": {
      const { type, x, y, anchors, ...props } = obj as CommentModelType;
      const anchor = anchors?.length ? anchors[0] : undefined;
      const properties = omitNullish({ ...props, anchor });
      changes.push({ operation: "create", target: "comment", parents: [x, y], properties });
      break;
    }
    case "image": {
      const { type, url, x, y, width, height, ...props } = obj as ImageModelType;
      const properties = omitNullish(props);
      changes.push({ operation: "create", target: "image", parents: [url, [x, y], [width, height]], properties });
      break;
    }
    case "movableLine": {
      const { type, p1, p2, ...props } = obj as MovableLineModelType;
      const { x: p1x, y: p1y, ...pt1 } = p1;
      const { x: p2x, y: p2y, ...pt2 } = p2;
      const properties = omitNullish({ ...props, pt1, pt2 });
      changes.push({ operation: "create", target: "movableLine", parents: [[p1x, p1y], [p2x, p2y]], properties });
      break;
    }
    case "point": {
      const { type, x, y, ...props } = obj as PointModelType;
      const properties = omitNullish(props);
      if (properties.labelOption) {
        properties.clientLabelOption = properties.labelOption;
        properties.labelOption = undefined;
      }
      changes.push({ operation: "create", target: "point", parents: [x, y], properties });
      break;
    }
    case "polygon": {
      const poly = obj as PolygonModelType;
      const { type, points: parents, labels, ...props } = poly;
      const properties = omitNullish(props);
      if (properties.labelOption) {
        properties.clientLabelOption = properties.labelOption;
        properties.labelOption = undefined;
      }
      if (properties.name) {
        properties.clientName = properties.name;
        properties.name = undefined;
      }
      changes.push({ operation: "create", target: "polygon", parents, properties });
      (labels || []).forEach(({ id, option, name }) => {
        const pts = pointIdsFromSegmentId(id);
        if (pts.length === 2) {
          const _parents = [pts[0], pts[1]];
          const _properties = { labelOption: option, name };
          changes.push({
            operation: "update", target: "polygon", targetID: poly.id, parents: _parents, properties: _properties });
        }
      });
      break;
    }
    case "vertexAngle": {
      const vAngle = obj as VertexAngleModelType;
      const { type, points: parents, ...props } = vAngle;
      const properties = omitNullish(props);
      changes.push({ operation: "create", target: "vertexAngle", parents, properties });
      break;
    }
    default:
      console.warn("convertModelToChanges: no conversion for model of type:", obj.type);
      break;
  }
  return changes;
};

// up to three decimal places; no trailing zeros
const fix3 = (value: number) => {
  let s = value.toFixed(3);
  // remove trailing zeros
  while (s[s.length - 1] === "0") {
    s = s.substring(0, s.length - 1);
  }
  // remove trailing decimal place
  if (s[s.length - 1] === ".") {
    s = s.substring(0, s.length - 1);
  }
  return s;
};

interface IGeomObjectInfo {
  id: string;
  type: JXGObjectType;
  changes: JXGChange[];   // changes that affect this object
  dependents: string[];   // ids of objects that depend on this object
  dependencies: string[]; // ids of objects this object depends upon
  isDeleted?: boolean;    // true if the object has been deleted
  noExport?: boolean;     // true if the object should not be exported individually
}

// change targets that don't correspond to objects in the JSXGraph board
const specialTargets = ["board", "metadata"];

function getTargetIdsFromChange(change: JXGChange) {
  if (specialTargets.includes(change.target)) return [change.target];
  if ((change.operation === "create") && (change.target === "tableLink")) {
    // returns the ids of the created linkedPoints
    return (change.properties as JXGProperties)?.ids || [];
  }
  if (change.targetID) return castArray(change.targetID);
  if (!change.properties) return [];
  return castArray(change.properties).map(props => props.id).filter(id => !!id);
}

function getDependenciesFromChange(change: JXGChange, objectInfoMap: Record<string, IGeomObjectInfo>): string[] {
  // comment dependency is the anchor
  if ((change.operation === "create") && (change.target === "comment")) {
    return [(change.properties as JXGProperties)?.anchor];
  }
  // polygon dependencies are the vertices
  if ((change.operation === "create") && (change.target === "polygon")) {
    return change.parents as string[];
  }
  // polygon segment label dependencies are the polygon and the labeled points
  if ((change.operation === "update") && (change.target === "polygon") && (change.properties as any)?.labelOption) {
    return [change.targetID, ...change.parents as string[]] as string[];
  }
  // vertex angle dependencies are the vertices and the polygon
  if ((change.operation === "create") && (change.target === "vertexAngle")) {
    const vertices = (change.parents || []) as string[];
    let polygonId = "";
    const dependentCount: Record<string, number> = {};
    vertices.forEach(vId => {
      const vInfo = objectInfoMap[vId];
      vInfo.dependents.forEach(depId => {
        if (!dependentCount[depId]) {
          dependentCount[depId] = 1;
        }
        else {
          if (++dependentCount[depId] >= 3) {
            polygonId = depId;
          }
        }
      });
    });
    return polygonId ? [polygonId, ...vertices] : vertices;
  }
  // line dependencies are the two points
  if ((change.operation === "create") && (change.target === "line")) {
    return (change.parents || []) as string[];
  }
  // movable line dependencies are the control points
  if ((change.operation === "create") && (change.target === "movableLine")) {
    const lineId = (change.properties as JXGProperties)?.id;
    const pointIds = lineId && getMovableLinePointIds(lineId);
    return pointIds || [];
  }
  return [];
}

//
// The following exportGeometry* methods are used only (a) in tests and (b) when
// importing old legacy Geometry content stored as a list of changes. At some
// point it would be good to do a content migration and delete this code.
//

export const exportGeometryJson = (changes: string[], options?: ITileExportOptions) => {
  return exportGeometry(changes, { ...options, json: true }) as string;
};

export const exportGeometryModel = (changes: string[], options?: ITileExportOptions) => {
  return exportGeometry(changes, { ...options, json: false }) as GeometryExtrasContentSnapshotType;
};

export const exportGeometry = (changes: string[], options?: ITileExportOptions) => {
  const outputJson = options?.json !== false;
  const objectInfoMap: Record<string, IGeomObjectInfo> = {};
  const orderedIds: string[] = [];
  const builder = new StringBuilder();
  let title: string | undefined;
  let boardModel: BoardModelType | undefined;
  let bgImage: ImageModelType | undefined;
  const objects = new Map<string, GeometryObjectModelType>();
  const links = new Set<string>();

  const addObjectModel = (obj: GeometryObjectModelType) => {
    objects.set(obj.id, obj);
  };

  const exportTitle = () => {
    if (objectInfoMap.metadata) {
      objectInfoMap.metadata.changes.forEach(change => {
        const changeTitle = (change.properties as JXGProperties)?.title;
        changeTitle && (title = changeTitle);
      });
      outputJson && title && builder.pushLine(`"title": "${title}",`, 2);
    }
  };

  const exportBoard = () => {
    if (!objectInfoMap.board) return;
    let props: any = {};
    objectInfoMap.board.changes.forEach(change => {
      const changeProps = change.properties as JXGProperties;
      const boardProps = changeProps.boardScale || changeProps;
      props = { ...props, ...boardProps };
    });
    const xMin: number = props.xMin ?? props.boundingBox?.[0];
    const yMin: number = props.yMin ?? props.boundingBox?.[3];
    const xRange: number = props.unitX
                            ? kGeometryDefaultWidth / props.unitX
                            : props.boundingBox?.[2] - xMin;
    const yRange: number = props.unitY
                            ? kGeometryDefaultHeight / props.unitY
                            : props.boundingBox?.[1] - yMin;
    const xUnit = props.unitX ?? kGeometryDefaultWidth / xRange;
    const yUnit = props.unitY ?? kGeometryDefaultHeight / yRange;
    if (outputJson) {
      const hasNames = (props.xName != null) || (props.yName != null);
      const hasLabels = (props.xAnnotation != null) || (props.yAnnotation != null);
      builder.pushLine(`"board": {`, 2);
      builder.pushLine(`"properties": {`, 4);
      builder.pushLine(`"axisMin": [${fix3(xMin)}, ${fix3(yMin)}],`, 6);
      builder.pushLine(`"axisRange": [${fix3(xRange)}, ${fix3(yRange)}]${comma(hasNames || hasLabels)}`, 6);
      hasNames && builder.pushLine(`"axisNames": ["${props.xName}", "${props.yName}"]${comma(hasLabels)}`, 6);
      hasLabels && builder.pushLine(`"axisLabels": ["${props.xAnnotation}", "${props.yAnnotation}"]`, 6);
      builder.pushLine(`}`, 4);
      builder.pushLine(`},`, 2);
    }
    else {
      boardModel = BoardModel.create({
        xAxis: { name: props.xName, label: props.xAnnotation, min: xMin, unit: xUnit, range: xRange },
        yAxis: { name: props.yName, label: props.yAnnotation, min: yMin, unit: yUnit, range: yRange }
      });
    }
  };

  const isValidId = (id: string) => !objectInfoMap[id]?.isDeleted;

  const isExportable = (id: string) => {
    if (!isValidId(id)) return false;

    const objInfo = objectInfoMap[id];
    // can't export types without an export function
    if (!exportFnMap[objInfo.type]) return false;
    // don't export non-exportable types
    if (objInfo.noExport) return false;

    if ((objInfo.type !== "movableLine") && !objInfo.dependencies.every(_id => !objectInfoMap[_id]?.noExport)) {
        return false;
    }
    return true;
  };

  const getParentsFromInitialChange = (id: string, change: JXGChange) => {
    if (change.target === "point") {
      if (Array.isArray(change.properties)) {
        const ptIndex = change.properties.findIndex(props => props.id === id);
        return (ptIndex >= 0) ? change.parents?.[ptIndex] as [number, number] : [];
      }
      return change.parents as [number, number];
    }
    if (change.target === "movableLine") {
      if (/.+-point1/.test(id)) return change.parents?.[0] as [number, number];
      if (/.+-point2/.test(id)) return change.parents?.[1] as [number, number];
    }
  };

  const exportComment = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let inParents = _changes[0].parents as JXGCoordPair | undefined;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    const { position, ...others } = props;
    if (others.id !== id) others.id = id;
    if ((position?.length >= 2) && props.anchor) {
      const anchorCentroid = getObjectCentroid(props.anchor);
      if (anchorCentroid) {
        // determine the relative offset from centroid
        inParents = [position[0] - anchorCentroid[0], position[1] - anchorCentroid[1]];
      }
    }

    if (outputJson) {
      const parents = inParents ? `, "parents": [${inParents[0]}, ${inParents[1]}]` : "";
      const otherProps = Object.keys(others).length > 0
                          ? ` "properties": ${JSON.stringify(others)}`
                          : "";
      return `{ "type": "comment"${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
    }

    addObjectModel(CommentModel.create({
      x: inParents?.[0], y: inParents?.[1], anchors: [props.anchor], ...others
    }));
    return "";
  };

  const exportImage = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    const inParents = _changes[0].parents as JXGImageParents;
    const inFilename = (_changes[0].properties as JXGProperties)?.filename;
    const [url, coords, size] = inParents;
    const transformedUrl = options?.transformImageUrl?.(url, inFilename) || url;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    const { filename, position, ...others } = props;
    if (others.id !== id) others.id = id;
    const x = position?.[0] ?? coords?.[0];
    const y = position?.[1] ?? coords?.[1];

    if (outputJson) {
      const sizeValue = `[${size[0]}, ${size[1]}]`;
      const parents = `"parents": { "url": "${transformedUrl}", "coords": [${x}, ${y}], "size": ${sizeValue} }`;
      const otherProps = Object.keys(others).length > 0
                          ? ` "properties": ${JSON.stringify(others)}`
                          : "";
      const json = `{ "type": "image", ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
      return json;
    }

    const imageModelSnapshot = { x, y, url, filename, width: size[0], height: size[1], ...others };
    bgImage = ImageModel.create(imageModelSnapshot);
    return "";
  };

  const getPointExportables = (id: string) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      if (Array.isArray(change.properties)) {
        const ptIndex = Array.isArray(change.targetID)
                          ? change.targetID.indexOf(id)
                          : change.properties.findIndex(p => p.id === id);
        (ptIndex >= 0) && (props = {...props, ...change.properties[ptIndex] });
      }
      else {
        props = {...props, ...change.properties };
      }
    });
    const { position, ...others } = props;
    if (others.id !== id) others.id = id;
    const changeParents = getParentsFromInitialChange(id, _changes[0]);
    let xPos, yPos: number;
    // some operations used normalized coordinates, which take the form [1, x, y]
    if (Array.isArray(position) && (position.length === 3)) {
      [, xPos, yPos] = position;
    }
    else {
      [xPos, yPos] = position || [];
    }
    const xParent = xPos ?? changeParents?.[0];
    const yParent = yPos ?? changeParents?.[1];
    const parents = [xParent, yParent] as JXGCoordPair;
    return { parents, others };
  };

  const getObjectCentroid = (id: string) => {
    const objInfo = objectInfoMap[id];
    if (!objInfo) return;

    switch (objInfo.type) {
      case "point": {
        const { parents } = getPointExportables(id);
        return parents;
      }
      case "movableLine":
      case "polygon": {
        let xSum = 0;
        let ySum = 0;
        let count = 0;
        objInfo.dependencies.forEach(depId => {
          const { parents } = getPointExportables(depId);
          if (parents?.length >= 2) {
            xSum += parents[0];
            ySum += parents[1];
            ++count;
          }
        });
        return count > 0 ? [xSum / count, ySum / count] : undefined;
      }
    }
  };

  const exportPoint = (id: string, isLast: boolean) => {
    const { parents: _parents, others } = getPointExportables(id);
    if (outputJson) {
      const parents = `"parents": [${_parents[0]}, ${_parents[1]}]`;
      const otherProps = Object.keys(others).length > 0
                          ? ` "properties": ${JSON.stringify(others)}`
                          : "";
      return `{ "type": "point", ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
    }

    addObjectModel(PointModel.create({
      x: _parents[0], y: _parents[1], ...others
    }));
    return "";
  };

  const validParentIds = (id: string) => {
    const objInfo = objectInfoMap[id];
    const _changes = objInfo.changes;
    const parents = objInfo.type === "comment"
                      ? [(_changes[0].properties as JXGProperties)?.anchor]
                      : objInfo.type === "movableLine"
                          ? getMovableLinePointIds(id)
                          : _changes[0].parents;
    return parents?.map(pId => {
      const parentId = pId as string;
      return isValidId(parentId)
              ? outputJson ? `"${parentId}"` : parentId
              : undefined;
    }).filter(vId => !!vId) as string[] || [];
  };

  const exportPolygon = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    const labelMap = new Map<string, { points: string[], option: ELabelOption }>();
    let props: any = {};
    _changes.forEach(change => {
      const { parents, properties } = change;
      const { labelOption } = properties as JXGProperties || {};
      if (parents?.length && labelOption) {
        const key = `${parents[0]}:${parents[1]}`;
        labelMap.set(key, { points: parents as string[], option: labelOption });
      }
      else {
        props = {...props, ...properties };
      }
    });
    if (props.id !== id) props.id = id;

    if (outputJson) {
      const parents = `"parents": [${validParentIds(id)?.join(", ")}]`;
      const otherProps = Object.keys(props).length > 0
                          ? `"properties": ${JSON.stringify(props)}`
                          : "";
      return `{ "type": "polygon", ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
    }

    const _labels: PolygonSegmentLabelModelSnapshot[] = [];
    labelMap.forEach((label, segmentId) => {
      _labels.push({ id: segmentId, option: label.option });
    });
    const labels = _labels.length ? _labels : undefined;
    addObjectModel(PolygonModel.create({
      points: validParentIds(props.id), labels, ...props
    }));
    return "";
  };

  const exportVertexAngle = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    if (props.id !== id) props.id = id;

    if (outputJson) {
      const type = `"type": "vertexAngle"`;
      const parents = `"parents": [${validParentIds(id)?.join(", ")}]`;
      const otherProps = Object.keys(props).length > 0
                          ? `"properties": ${JSON.stringify(props)}`
                          : "";
      return `{ ${type}, ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
    }

    addObjectModel(VertexAngleModel.create({
      points: validParentIds(props.id), ...props
    }));
    return "";
  };

  const exportLine = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    if (props.id !== id) props.id = id;

    if (outputJson) {
      const type = `"type": "line"`;
      const parents = `"parents": [${validParentIds(id)?.join(", ")}]`;
      const otherProps = Object.keys(props).length > 0
                          ? `"properties": ${JSON.stringify(props)}`
                          : "";
      return `{ ${type}, ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
    }

    addObjectModel(LineModel.create({
      point1: validParentIds(props.id)[0],
      point2: validParentIds(props.id)[1],
      ...props
    }));
    return "";
  };

  const exportMovableLinePoint = (id: string) => {
    const { parents } = getPointExportables(id);

    if (outputJson) {
      return `{ "type": "point", "parents": [${parents[0]}, ${parents[1]}] }`;
    }

    return { x: parents[0], y: parents[1] };
  };

  const exportMovableLine = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    if (props.id !== id) props.id = id;
    const pointIds = getMovableLinePointIds(id);

    if (outputJson) {
      const type = `"type": "movableLine"`;
      const parents = `"parents": [${exportMovableLinePoint(pointIds[0])}, ${exportMovableLinePoint(pointIds[1])}]`;
      const otherProps = Object.keys(props).length > 0
                          ? `"properties": ${JSON.stringify(props)}`
                          : "";
      return `{ ${type}, ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
    }

    const { x: p1x, y: p1y } = exportMovableLinePoint(pointIds[0]) as { x: number, y: number };
    const { x: p2x, y: p2y } = exportMovableLinePoint(pointIds[1]) as { x: number, y: number };
    const { pt1, pt2, ...properties } = props;
    const p1 = PointModel.create({ x: p1x, y: p1y, ...pt1, id: `${id}-point1` });
    const p2 = PointModel.create({ x: p2x, y: p2y, ...pt2, id: `${id}-point2` });
    addObjectModel(MovableLineModel.create({ p1, p2, ...properties }));
    return "";
  };

  const exportFnMap: Partial<Record<JXGObjectType, (id: string, isLast: boolean) => string>> = {
    comment: exportComment,
    image: exportImage,
    line: exportLine,
    movableLine: exportMovableLine,
    point: exportPoint,
    polygon: exportPolygon,
    vertexAngle: exportVertexAngle
  };

  const exportObject = (id: string, isLast: boolean) => {
    const type = objectInfoMap[id]?.type;
    return type && exportFnMap[type]?.(id, isLast);
  };

  const exportObjects = () => {
    builder.pushLine(`"objects": [`, 2);
    let lastExportedId: string;
    orderedIds.forEach(id => {
      if (isExportable(id)) {
        lastExportedId = id;
      }
    });
    orderedIds.forEach(id => {
      if (isExportable(id)) {
        const objLine = exportObject(id, id === lastExportedId);
        objLine && castArray(objLine).forEach(line => builder.pushLine(line, 4));
      }
    });
    builder.pushLine(`]${comma(links.size > 0)}`, 2);
  };

  const exportLinks = () => {
    if (outputJson) {
      links.size && builder.pushLine(`"links": ["${Array.from(links).join(`", "`)}"]`, 2);
    }
  };

  // loop through each change, adding it to the set of changes that affect each object
  changes.forEach(changeJson => {
    const change = safeJsonParse<JXGChange>(changeJson);
    if (change) {
      // map tableLink changes to links array
      if (change.target === "tableLink") {
        change.links?.tileIds.forEach(tableId => {
          if (change.operation === "create") {
            links.add(tableId);
          }
          else if (change.operation === "delete") {
            links.delete(tableId);
          }
        });
        return;
      }
      const target = change.target;
      const ids = getTargetIdsFromChange(change);
      const dependencies = getDependenciesFromChange(change, objectInfoMap);
      ids.forEach(id => {
        // track movable line control points so we can track changes to them
        if ((change.operation === "create") && (target === "movableLine")) {
          getMovableLinePointIds(id).forEach(ptId => {
            objectInfoMap[ptId] = {
              id: ptId,
              type: "point",
              changes: [change],
              dependents: [],
              dependencies: [],
              noExport: true  // movable line control points aren't individually exportable
            };
            orderedIds.push(ptId);
          });
        }
        if (!objectInfoMap[id]) {
          objectInfoMap[id] = {
            id,
            type: target,
            changes: [change],
            dependents: [],
            dependencies,
            noExport: target === "linkedPoint"
          };
          dependencies.forEach(independentId => {
            const objectInfo = objectInfoMap[independentId];
            objectInfo?.dependents.push(id);
          });
          if (!specialTargets.includes(id)) {
            orderedIds.push(id);
          }
        }
        else {
          objectInfoMap[id].changes.push(change);

          // deleted objects and their dependents aren't exported
          if (change.operation === "delete") {
            objectInfoMap[id].isDeleted = true;
            // deleting a movable line deletes its points
            if (objectInfoMap[id].type === "movableLine") {
              getMovableLinePointIds(id).forEach(ptId => {
                objectInfoMap[ptId].changes.push(change);
                objectInfoMap[ptId].isDeleted = true;
              });
            }
          }
        }
      });
    }
  });

  if (outputJson) {
    builder.pushLine("{");
    builder.pushLine(`"type": "Geometry",`, 2);
    exportTitle();
    exportBoard();
    exportObjects();
    exportLinks();
    builder.pushLine("}");
    return builder.build();
  }
  else {
    exportTitle();
    exportBoard();
    exportObjects();
    const extras = title ? { extras: { title } } : undefined;
    const _objects = Object.fromEntries(objects) as any;
    const _links = links.size ? { links: Array.from(links) } : undefined;
    return { type: "Geometry", board: boardModel, bgImage, objects: _objects, ..._links, ...extras };
  }
};
