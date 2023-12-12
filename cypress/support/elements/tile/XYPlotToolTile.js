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
  getAddSeriesButton(workspaceClass){
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .add-series-button`);
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
  getHighlightedDot(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-dot .outer-circle.selected`);
  }
  getXAxisLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .display-label.bottom`);
  }
  getXAttributesLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .x-axis-menu .simple-attribute-label`);
  }
  getYAttributesLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .simple-attribute-label`);
  }
  selectYAttribute(attribute, workspaceClass) {
    this.getYAttributesLabel(workspaceClass).first().click({ force: true });
    cy.get(`.chakra-portal button`).contains(attribute).click({ force: true });
  }
  getEditableLimits(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .graph-plot .editable-border-box`);
  }
}
export default XYPlotToolTile;
