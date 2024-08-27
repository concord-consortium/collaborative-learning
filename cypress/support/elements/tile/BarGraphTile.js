class BarGraphTile {

  getTiles(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .bar-graph-tile`);
  }

  getTile(tileIndex = 0, workspaceClass) {
    return this.getTiles().eq(tileIndex);
  }

  getTileTitle(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.editable-tile-title-text`);
  }

}
export default BarGraphTile;
