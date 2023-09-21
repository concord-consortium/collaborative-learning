class XYPlotToolTile {
  getTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .graph-tool-tile`);
  }
  getXYPlotTitle(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .editable-tile-title`);
  }
  getLinkTileButton(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .graph-toolbar .link-tile-button`);
  }
  getCustomModal() {
    return cy.get('.custom-modal.link-tile');
  }
  linkTable(table) {
      cy.get('select').select(table);
      cy.get('.modal-button').contains("Link").click();
  }
  getGraphDot(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .graph-dot`);
  }
}
export default XYPlotToolTile;
