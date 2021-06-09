import { castArray } from "lodash";
import { safeJsonParse } from "../../../utilities/js-utils";
import { JXGChange, JXGCoordPair, JXGImageParents, JXGObjectType, JXGProperties } from "./jxg-changes";
import {
  getMovableLinePointIds, kGeometryDefaultHeight, kGeometryDefaultPixelsPerUnit, kGeometryDefaultWidth
} from "./jxg-types";

// up to three decimal places; no trailing zeros
const fix3 = (value: number) => {
  let s = value.toFixed(3);
  while (s[s.length - 1] === "0") {
    s = s.substr(0, s.length - 1);
  }
  if (s[s.length - 1] === ".") {
    s = s.substr(0, s.length - 1);
  }
  return s;
};

interface IGeomObjectInfo {
  id: string;
  type: JXGObjectType;
  changes: JXGChange[];   // changes that affect this object
  dependents: string[];   // ids of objects that depend on this object
  dependencies: string[]; // ids of objects this objects depends upon
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
  // movable line dependencies are the control points
  if ((change.operation === "create") && (change.target === "movableLine")) {
    const lineId = (change.properties as JXGProperties)?.id;
    const pointIds = lineId && getMovableLinePointIds(lineId);
    return pointIds || [];
  }
  return [];
}

export const exportGeometryJson = (changes: string[]) => {
  const objectInfoMap: Record<string, IGeomObjectInfo> = {};
  const orderedIds: string[] = [];
  const lines: string[] = [];

  const pushLine = (line: string, indent: number) => {
    let space = "";
    for (; space.length < indent; space += " ");
    lines.push(space + line);
  };

  const comma = (condition: boolean) => condition ? "," : "";

  const exportBoard = () => {
    if (!objectInfoMap.board) return;
    let props: any = {};
    objectInfoMap.board.changes.forEach(change => {
      const changeProps = change.properties as JXGProperties;
      const boardProps = changeProps.boardScale || changeProps;
      props = { ...props, ...boardProps };
    });
    const xMin: number = props.xMin ?? props.boundingBox[0];
    const yMin: number = props.yMin ?? props.boundingBox[3];
    const xRange: number = props.unitX
                            ? kGeometryDefaultWidth / props.unitX
                            : props.boundingBox[2] - xMin;
    const yRange: number = props.unitY
                            ? kGeometryDefaultHeight / props.unitY
                            : props.boundingBox[1] - yMin;
    const hasNames = (props.xName != null) || (props.yName != null);
    const hasLabels = (props.xAnnotation != null) || (props.yAnnotation != null);
    pushLine(`"board": {`, 2);
    pushLine(`"properties": {`, 4);
    pushLine(`"axisMin": [${fix3(xMin)}, ${fix3(yMin)}],`, 6);
    pushLine(`"axisRange": [${fix3(xRange)}, ${fix3(yRange)}]${comma(hasNames || hasLabels)}`, 6);
    hasNames && pushLine(`"axisNames": ["${props.xName}", "${props.yName}"]${comma(hasLabels)}`, 6);
    hasLabels && pushLine(`"axisLabels": ["${props.xAnnotation}", "${props.yAnnotation}"]`, 6);
    pushLine(`}`, 4);
    pushLine(`},`, 2);
  };

  const isValidId = (id: string) => objectInfoMap[id] && !objectInfoMap[id].isDeleted;

  const isExportable = (id: string) => {
    if (!isValidId(id)) return false;

    const objInfo = objectInfoMap[id];
    // can't export types without an export function
    if (!exportFnMap[objInfo.type]) return false;
    // don't export non-exportable types
    if (objInfo.noExport) return false;

    // must have valid/sufficient dependencies
    if (["comment", "movableLine", "polygon", "vertexAngle"].includes(objInfo.type)) {
      const minParentsMap: { [K in JXGObjectType]?: number } =
              { comment: 1, movableLine: 2, polygon: 2, vertexAngle: 3 };
      const minParents = minParentsMap[objInfo.type];
      const parents = validParentIds(id);
      if (minParents && (parents.length < minParents)) return false;
      // all dependencies must be exportable (except movable line control points)
      if ((objInfo.type !== "movableLine") && !objInfo.dependencies.every(_id => !objectInfoMap[_id]?.noExport)) {
        return false;
      }
      // all dependencies must be valid (except for a subset of polygon vertices)
      if ((objInfo.type !== "polygon") && !objInfo.dependencies.every(isValidId)) {
        return false;
      }
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
    const parents = inParents ? `, "parents": [${inParents[0]}, ${inParents[1]}]` : "";
    const otherProps = Object.keys(others).length > 0
                        ? ` "properties": ${JSON.stringify(others)}`
                        : "";
    return `{ "type": "comment"${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
  };

  const exportImage = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    const inParents = _changes[0].parents as JXGImageParents;
    const [url, coords, size] = inParents;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    const { position, ...others } = props;
    if (others.id !== id) others.id = id;
    const x = position?.[0] ?? coords?.[0];
    const y = position?.[1] ?? coords?.[1];
    const pxSize = size.map(s => Math.round(s * kGeometryDefaultPixelsPerUnit));
    const parents = `"parents": { "url": "${url}", "coords": [${x}, ${y}], "size": [${pxSize[0]}, ${pxSize[1]}] }`;
    const otherProps = Object.keys(others).length > 0
                        ? `"properties": ${JSON.stringify(others)}`
                        : "";
    return `{ "type": "image", ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
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
    const xParent = position?.[0] ?? changeParents?.[0];
    const yParent = position?.[1] ?? changeParents?.[1];
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
    const parents = `"parents": [${_parents[0]}, ${_parents[1]}]`;
    const otherProps = Object.keys(others).length > 0
                        ? ` "properties": ${JSON.stringify(others)}`
                        : "";
    return `{ "type": "point", ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
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
      return isValidId(parentId) ? `"${parentId}"` : undefined;
    }).filter(vId => !!vId) || [];
  };

  const exportPolygon = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    if (props.id !== id) props.id = id;
    const parents = `"parents": [${validParentIds(id)?.join(", ")}]`;
    const otherProps = Object.keys(props).length > 0
                        ? `"properties": ${JSON.stringify(props)}`
                        : "";
    return `{ "type": "polygon", ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
  };

  const exportVertexAngle = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    if (props.id !== id) props.id = id;
    const type = `"type": "vertexAngle"`;
    const parents = `"parents": [${validParentIds(id)?.join(", ")}]`;
    const otherProps = Object.keys(props).length > 0
                        ? `"properties": ${JSON.stringify(props)}`
                        : "";
    return `{ ${type}, ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
  };

  const exportMovableLinePoint = (position: JXGCoordPair) => {
    return `{ "type": "point", "parents": [${position[0]}, ${position[1]}] }`;
  };

  const exportMovableLine = (id: string, isLast: boolean) => {
    const _changes = objectInfoMap[id].changes;
    let props: any = {};
    _changes.forEach(change => {
      props = {...props, ...change.properties };
    });
    if (props.id !== id) props.id = id;
    const type = `"type": "movableLine"`;
    const pointIds = getMovableLinePointIds(id);
    const { parents: pt0Position } = getPointExportables(pointIds[0]);
    const { parents: pt1Position } = getPointExportables(pointIds[1]);
    const parents = `"parents": [${exportMovableLinePoint(pt0Position)}, ${exportMovableLinePoint(pt1Position)}]`;
    const otherProps = Object.keys(props).length > 0
                        ? `"properties": ${JSON.stringify(props)}`
                        : "";
    return `{ ${type}, ${parents}${comma(!!otherProps)}${otherProps} }${comma(!isLast)}`;
  };

  const exportFnMap: Partial<Record<JXGObjectType, (id: string, isLast: boolean) => string>> = {
    comment: exportComment,
    image: exportImage,
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
    pushLine(`"objects": [`, 2);
    let lastExportedId: string;
    orderedIds.forEach(id => {
      if (isExportable(id)) {
        lastExportedId = id;
      }
    });
    orderedIds.forEach(id => {
      if (isExportable(id)) {
        const objLine = exportObject(id, id === lastExportedId);
        objLine && castArray(objLine).forEach(line => pushLine(line, 4));
      }
    });
    pushLine(`]`, 2);
  };

  // loop through each change, adding it to the set of changes that affect each object
  changes.forEach(changeJson => {
    const change = safeJsonParse<JXGChange>(changeJson);
    if (change) {
      // objects created by a tableLink are the linkedPoints
      const target = change.target === "tableLink"
                      ? "linkedPoint"
                      : change.target;
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

  pushLine(`"type": "Geometry",`, 2);
  if (objectInfoMap.metadata) {
    let title = "";
    objectInfoMap.metadata.changes.forEach(change => {
      const changeTitle = (change.properties as JXGProperties)?.title;
      changeTitle && (title = changeTitle);
    });
    title && pushLine(`"title": "${title}",`, 2);
  }
  exportBoard();
  exportObjects();
  return [
    `{`,
    ...lines,
    `}`
  ].join("\n");
};
