import { GeometryContentSnapshotType } from "../../../models/tiles/geometry/geometry-content";
import { applyChange, applyChanges } from "../../../models/tiles/geometry/jxg-dispatcher";
import { getAllLinkedPoints, injectGetTableLinkColorsFunction } from "../../../models/tiles/geometry/jxg-table-link";

/**
 * Get an object of points and polygons by source
 */

export function getBoardModelDiff(board: JXG.Board, modelData: any){
  console.log("all1: getBoardModelDiff")
}

export function getBoardObjectIds(board: JXG.Board){
  console.log("all1: getBoardObjectIds")
}

export function updateBoardPoints(board: JXG.Board, modelData: any /*GeometryContentSnapshotType */){
  console.log("all1: updateBoardPoints")
}

export function updateBoardPolygons(board: JXG.Board, modelData: any /*GeometryContentSnapshotType */){
  console.log("all1: updateBoardPolygons")
}




/*

zyncLinkedPoints(_board?: JXG.Board) {
  const board = _board || this.state.board;
  if (!board) return;

  // remove/recreate all linked points
  // TODO: A more tailored response would match up the existing points with the data set and only
  // change the affected points, which would eliminate some visual flashing that occurs when
  // unchanged points are re-created and would allow derived polygons to be preserved.
  // for now, derived polygons persist in model, and are now sent to JXG as changes
  // on each load/creation so that they render

  // REALIZED
  // GOING TO PACKAGE ALL THIS IN A FUNCTION THAT IS CALLED INSTEAD OF zyncLInkedPoints
  // it would be called from same spot, but called syncGeometryWithSharedData - which will have sub functions
  // it will combine all the stuff
  // I will write it in another file
  // I looked through all this and nothing else (except few "linked" moments, are about shared)
  // it will need applyChanges, access to model.getContent() and board
  // search "const content" and u will find examples of bringing model in

  // like this , this only has a value to delete at the moment a share happens. Even with the applyChange(delete change) below commented out.
  const ids = getAllLinkedPoints(board);
  console.log("theIds here: ", ids)
  applyChange(board, { operation: "delete", target: "linkedPoint", targetID: ids });

  // set up to track found minimums and maximums among all shared points
  let xMin = -1
  let xMax = 1
  let yMin = -1
  let yMax = 1

  // create new points for each linked table
  this.getContent().linkedDataSets.forEach(link => {
    const links: ILinkProperties = { tileIds: [link.providerId] };
    const parents: JXGCoordPair[] = [];
    const properties: Array<{ id: string }> = [];
    for (let ci = 0; ci < link.dataSet.cases.length; ++ci) {
      const x = link.dataSet.attributes[0]?.numericValue(ci);
      for (let ai = 1; ai < link.dataSet.attributes.length; ++ai) {
        const attr = link.dataSet.attributes[ai];
        const id = linkedPointId(link.dataSet.cases[ci].__id__, attr.id);
        const y = attr.numericValue(ci);
        if (isFinite(x) && isFinite(y)) {
          if ( x < xMin ) xMin = x - 1
          if ( x > xMax ) xMax = x + 1
          if ( x < yMin ) yMin = y - 1
          if ( x > yMax ) yMax = y + 1
          parents.push([x, y]);
          properties.push({ id });
        }
      }
    }
    const pts = applyChange(board, { operation: "create", target: "linkedPoint", parents, properties, links });
    castArray(pts || []).forEach(pt => !isBoard(pt) && this.handleCreateElements(pt));
  });

  this.rescaleBoardAndAxes({ xMax, yMax, xMin, yMin });
  this.syncLinkedPolygons(board);
}

syncLinkedPolygons(board: JXG.Board){
  const justThePoints = board.objectsList.filter((o) => o.elType === "point")
  const sharedPointIds = getAllLinkedPoints(board)
  const objectsMap = this.getContent().objects;
  const allObjectsArr = Array.from(objectsMap, ([key, value]) => ({key,value}));

  // If object is a polygon, extract its id and dependent point ids
  const changes: JXGChange[] = [];
  allObjectsArr.forEach((o) => {
    if (o.value.type === "polygon"){
      const ids: string[] = [];
      const idSet = { polygonId: o.value.id, pointIds: ids };
      (o.value as any).points.forEach((k:string) => {
        const pointId = k;
        idSet.pointIds.push(pointId);
      });
      // convert idSet to a change
      const polygonChangeObject: JXGChange = {
        operation: "create", // not "update" at the moment. This does not create a duplicate
        target: "polygon",
        targetID: idSet.polygonId,
        parents: idSet.pointIds,
        properties: { id: idSet.polygonId }
      };
      changes.push(polygonChangeObject);
    }
  });
  applyChanges(board, changes);
}

*/