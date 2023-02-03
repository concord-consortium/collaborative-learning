import { GeometryContentSnapshotType } from "../../../models/tiles/geometry/geometry-content";
import { applyChange, applyChanges } from "../../../models/tiles/geometry/jxg-dispatcher";
import { getAllLinkedPoints, injectGetTableLinkColorsFunction } from "../../../models/tiles/geometry/jxg-table-link";

interface ObjectMapEntry {
  id: string,
  elType: string,
  dataSource: string,
  x?: number | undefined,
  y?: number | undefined
}

/**
 * some of these may return updated stuff...
 */

export function getBoardModelDiff(board: JXG.Board, linkedData: any){
  console.log("all1: getBoardModelDiff: ",   {board}, {linkedData});
}

export function getBoardDataExtents(objectsMap: Map<string, ObjectMapEntry>){
  let xMax = 1;
  let yMax = 1;
  let xMin = -1;
  let yMin = -1;

  for (let [key, value] of objectsMap){
    const validPoint = value.elType === "point"
    const graphable = value.dataSource === "shared" || value.dataSource === "local"
    if (validPoint && graphable){
      const pointX = value.x || 0
      const pointY = value.y || 0
      if (pointX < xMin) xMin = pointX - 1
      if (pointX > xMax) xMax = pointX + 1
      if (pointY < yMin) yMin = pointY - 1
      if (pointY > yMax) yMax = pointY + 1
    }
  }

  return { xMax, yMax, xMin, yMin } // can be passed to rescaleBoardAndAxes()
}

export function getBoardObjectMap(board: JXG.Board){
  const boardObjectMap = new Map<string, ObjectMapEntry>;

  // collect info on all points
  const points = board.objectsList.filter((o) => o.elType === "point");
  points.forEach((point:any) => {
    const hasSharedPointId = point.id.includes(":");
    const hasAxisPointId = point.id.includes("jxgBoard");
    const hasLocalCreatedId = !hasSharedPointId && !hasAxisPointId && point.id.length === 16;

    let pointSource = "" // these possible values should be enumerated in a type of some kind?
    if (hasSharedPointId) pointSource = "shared";
    if (hasAxisPointId) pointSource = "axis";
    if (hasLocalCreatedId) pointSource = "local";

    boardObjectMap.set(point.id, {
      id: point.id,
      elType: "point",
      dataSource: pointSource,
      x: Math.round(point.coords.usrCoords[1]),
      y: Math.round(point.coords.usrCoords[2])
    });
  });

  const polygons = board.objectsList.filter((o) => o.elType === "polygon")
  polygons.forEach((polygon:any) => {
    const constituentPoints = polygon.inherits[0]
    const isShared = constituentPoints.find((pt:any) => pt.id.includes(":"))

    boardObjectMap.set(polygon.id, {
      id: polygon.id,
      elType: "polygon",
      dataSource: isShared ? "shared" : "local"
    })
  })

  return boardObjectMap
}

export function updateBoardPoints(board: JXG.Board, linkedData: any /*GeometryContentSnapshotType */){
  console.log("all1: updateBoardPoints", {board}, {linkedData})
}

export function updateBoardPolygons(board: JXG.Board, linkedData: any /*GeometryContentSnapshotType */){
  console.log("all1: updateBoardPolygons", {board}, {linkedData})
}




