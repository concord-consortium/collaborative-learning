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
  getXAxisLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .display-label.bottom`);
  }
  selectYAttribute(attribute, workspaceClass) {
    const yMenuButtons = `${wsClass(workspaceClass)} [data-testid=axis-legend-attribute-menu-left] button`;
    const yAttributeButton = `${wsClass(workspaceClass)} [data-testid=axis-legend-attribute-${attribute}]`;
    cy.get(yMenuButtons).first().click();
    cy.get(yAttributeButton).contains(attribute).click({force:true});
  }
  getYAttributesLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .simple-attribute-label`);
  }
}
export default XYPlotToolTile;
