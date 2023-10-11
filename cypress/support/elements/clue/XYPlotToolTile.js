function wsClass(wsc) {
  return wsc || ".primary-workspace";
}

class XYPlotToolTile {
  getTile(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-tool-tile`);
  }
  getXYPlotTitle(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .editable-tile-title`);
  }
  getLinkTileButton(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-toolbar .link-tile-button`);
  }
  getCustomModal() {
    return cy.get('.custom-modal.link-tile');
  }
  linkTable(table) {
      cy.get('select').select(table);
      cy.get('.modal-button').contains("Link").click();
  }
  getGraphDot(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-dot`);
  }
  getXAxisLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .display-label.bottom`);
  }
  selectYAttribute(attribute, workspaceClass) {
    const yMenuButtons = `${wsClass(workspaceClass)} .axis-legend-attribute-menu.left button`;
    cy.get(yMenuButtons).first().click();
    cy.get(yMenuButtons).contains(attribute).click();
  }
}
export default XYPlotToolTile;
