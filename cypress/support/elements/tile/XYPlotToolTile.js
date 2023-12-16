function wsClass(workspaceClass) {
  return workspaceClass || ".primary-workspace";
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
  getPortalButton(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .chakra-portal button`);
  }
  clickPortalButton(buttonText, workspaceClass) {
    this.getPortalButton(workspaceClass).contains(buttonText).click({ force: true });
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
  getMultiLegend(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .graph-tool-tile .multi-legend`);
  }
  getVariableDropdowns(workspaceClass) {
    return this.getMultiLegend(workspaceClass).find(".variable-function-legend-button");
  }
  getXVariableDropdown(workspaceClass) {
    return this.getVariableDropdowns(workspaceClass).eq(0);
  }
  selectXVariable(variableName, workspaceClass) {
    this.getXVariableDropdown().click();
    this.clickPortalButton(variableName, workspaceClass);
  }
  getYVariableDropdown(workspaceClass) {
    return this.getVariableDropdowns(workspaceClass).eq(1);
  }
  selectYVariable(variableName, workspaceClass) {
    this.getYVariableDropdown().click();
    this.clickPortalButton(variableName, workspaceClass);
  }
  getEditableAxisBox(axis, minOrMax) {
    return this.getTile().find(`[data-testid=editable-border-box-${axis}-${minOrMax}]`);
  }
}
export default XYPlotToolTile;
