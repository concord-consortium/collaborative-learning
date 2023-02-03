import { GeometryContentSnapshotType } from "../../../models/tiles/geometry/geometry-content";
import { applyChange, applyChanges } from "../../../models/tiles/geometry/jxg-dispatcher";
import { getAllLinkedPoints, injectGetTableLinkColorsFunction } from "../../../models/tiles/geometry/jxg-table-link";
import { JXGCoordPair, ILinkProperties } from "../../../models/tiles/geometry/jxg-changes";
import { linkedPointId } from "../../../models/tiles/table-link-types";

export interface ObjectMapEntry {
  id: string,
  elType: string,
  dataSource: string,
  x?: number | undefined,
  y?: number | undefined
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
  return { xMax, yMax, xMin, yMin } // matches type that can be passed to rescaleBoardAndAxes()
}

export function getModelObjectMap(modelContent:any){
  const modelObjectsMap = new Map<string, ObjectMapEntry>;
  for (let [key, value] of modelContent.data_){
    console.log("nice value to be: ", value.value_)
  }
}

export function getBoardObjectsMap(board: JXG.Board){
  const boardObjectsMap = new Map<string, ObjectMapEntry>;

  const points = board.objectsList.filter((o) => o.elType === "point");
  points.forEach((point:any) => {
    const hasSharedPointId = point.id.includes(":");
    const hasAxisPointId = point.id.includes("jxgBoard");
    const hasLocalCreatedId = !hasSharedPointId && !hasAxisPointId && point.id.length === 16;

    let pointSource = "" // these possible values should be enumerated in a type of some kind?
    if (hasSharedPointId) pointSource = "shared";
    if (hasAxisPointId) pointSource = "axis";
    if (hasLocalCreatedId) pointSource = "local";

    boardObjectsMap.set(point.id, {
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

    boardObjectsMap.set(polygon.id, {
      id: polygon.id,
      elType: "polygon",
      dataSource: isShared ? "shared" : "local"
    })
  })

  return boardObjectsMap
}

export function updateBoardPoints(board: JXG.Board, linkedData: any){
  console.log("all1: updateBoardPoints", {board}, {linkedData})
}

export function updateBoardPolygons(board: JXG.Board, linkedData: any){
  console.log("all1: updateBoardPolygons", {board}, {linkedData})
}




