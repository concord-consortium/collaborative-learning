export function copyCoords(coords: JXG.Coords) {
  return new JXG.Coords(JXG.COORDS_BY_USER, coords.usrCoords.slice(1), coords.board);
}

// cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
export function getEventCoords(board: JXG.Board, evt: any, scale?: number, index?: number) {
  const _index = index != null
                  ? index
                  : (evt[JXG.touchProperty] ? 0 : undefined);
  const cPos = board.getCoordsTopLeftCorner();
  const absPos = JXG.getPosition(evt, _index);
  const dx = (absPos[0] - cPos[0]) / (scale || 1);
  const dy = (absPos[1] - cPos[1]) / (scale || 1);

  return new JXG.Coords(JXG.COORDS_BY_SCREEN, [dx, dy], board);
}

// Replacement for Board.getAllObjectsUnderMouse() which doesn't handle scaled coordinates
export function getAllObjectsUnderMouse(board: JXG.Board, evt: any, scale?: number) {
  const coords = getEventCoords(board, evt, scale);
  return board.objectsList.filter(obj => {
    return obj.visPropCalc.visible && obj.hasPoint &&
            obj.hasPoint(coords.scrCoords[1], coords.scrCoords[2]);
  });
}

export function rotateCoords(coords: JXG.Coords, center: JXG.Coords, angle: number) {
  // express x, y relative to center of rotation
  const dx = coords.usrCoords[1] - center.usrCoords[1];
  const dy = coords.usrCoords[2] - center.usrCoords[2];
  // rotate
  const sinAngle = Math.sin(angle);
  const cosAngle = Math.cos(angle);
  let x = dx * cosAngle - dy * sinAngle;
  let y = dx * sinAngle + dy * cosAngle;
  // offset back to original location
  x += center.usrCoords[1];
  y += center.usrCoords[2];
  return new JXG.Coords(JXG.COORDS_BY_USER, [x, y], coords.board);
}
