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
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .bottom .simple-attribute-label`);
  }
  getYAttributesLabel(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .left .simple-attribute-label`);
  }
  getPortalButton(listClass="", workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .chakra-portal ${listClass} button`).filter(':visible');
  }
  clickPortalButton(buttonText, listClass, workspaceClass) {
    this.getPortalButton(listClass, workspaceClass).contains(buttonText).click({ force: true });
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
  getPlottedVariablesLegend(workspaceClass) {
    return this.getMultiLegend(workspaceClass).find(".plotted-variables-legend");
  }
  getVariableDropdowns(workspaceClass) {
    return this.getPlottedVariablesLegend(workspaceClass).find(".legend-dropdown-button");
  }
  getXVariableDropdown(traceNumber = 0, workspaceClass) {
    return this.getVariableDropdowns(workspaceClass).eq(traceNumber * 3 + 1);
  }
  // This function only works for the first menu, including y variables :\
  selectXVariable(variableName, traceNumber = 0, workspaceClass) {
    this.getXVariableDropdown(traceNumber).click();
    this.clickPortalButton(variableName, ".normal-menu-list", workspaceClass);
  }
  getYVariableDropdown(traceNumber = 0, workspaceClass) {
    return this.getVariableDropdowns(workspaceClass).eq(traceNumber * 3 + 2);
  }
  // This function only works for the first menu, including x variables :\
  selectYVariable(variableName, traceNumber = 0, workspaceClass) {
    this.getYVariableDropdown(traceNumber).click();
    this.clickPortalButton(variableName, ".normal-menu-list", workspaceClass);
  }
  getRemoveVariablesButtons(workspaceClass) {
    return this.getPlottedVariablesLegend(workspaceClass).find("button.remove-button");
  }
  getRemoveVariablesButton(traceNumber = 0, workspaceClass) {
    return this.getRemoveVariablesButtons().eq(traceNumber);
  }
  getAddVariablesButton(workspaceClass) {
    return this.getPlottedVariablesLegend(workspaceClass).find("button.add-series-button");
  }
  getEditableAxisBox(axis, minOrMax) {
    return this.getTile().find(`[data-testid=editable-border-box-${axis}-${minOrMax}]`);
  }
}
export default XYPlotToolTile;
