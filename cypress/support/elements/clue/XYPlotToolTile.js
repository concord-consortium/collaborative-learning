class XYPlotToolTile {
  getTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .graph-tool-tile`);
  }
}
export default XYPlotToolTile;
