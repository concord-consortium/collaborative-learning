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
  getPortalButton(wsc) {
    return cy.get(`${wsClass(wsc)} .chakra-portal button`);
  }
  clickPortalButton(buttonText, wsc) {
    this.getPortalButton(wsc).contains(buttonText).click({ force: true });
  }
  selectYAttribute(attribute, workspaceClass) {
    this.getYAttributesLabel(workspaceClass).first().click({ force: true });
    this.clickPortalButton(attribute, workspaceClass);
  }
  getAdornments(adornmentType, workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .graph-tool-tile .graph-adornments-grid${adornmentType ? " ." + adornmentType : ""}`);
  }
  getPlottedVariablesPath(workspaceClass) {
    return this.getAdornments("plotted-function", workspaceClass).find("path");
  }
  getMultiLegend(wsc) {
    return cy.get(`${wsClass(wsc)} .graph-tool-tile .multi-legend`);
  }
  getVariableDropdowns(wsc) {
    return this.getMultiLegend(wsc).find(".variable-function-legend-button");
  }
  getXVariableDropdown(wsc) {
    return this.getVariableDropdowns(wsc).eq(0);
  }
  selectXVariable(variableName, wsc) {
    this.getXVariableDropdown().click();
    this.clickPortalButton(variableName, wsc);
  }
  getYVariableDropdown(wsc) {
    return this.getVariableDropdowns(wsc).eq(1);
  }
  selectYVariable(variableName, wsc) {
    this.getYVariableDropdown().click();
    this.clickPortalButton(variableName, wsc);
  }
}
export default XYPlotToolTile;
