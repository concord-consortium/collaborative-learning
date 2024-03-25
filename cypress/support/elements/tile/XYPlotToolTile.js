function wsClass(workspaceClass) {
  return workspaceClass || ".primary-workspace";
}

class XYPlotToolTile {
  getTile(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-tool-tile`);
  }
  getGraphBackground(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} svg [data-testid=graph-background]`);
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
      cy.get('.modal-button').contains("Graph It!").click();
  }
  linkDataCard(table) {
    cy.get('[data-test=link-tile-select]').select(table);
    cy.get('.modal-button').contains("Graph It!").click();
}
  linkProgram(program) {
      cy.get('[data-test=link-tile-select]').select(program);
      cy.get('.modal-button').contains("Graph It!").click();
  }
  getGraphDot(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-dot`);
  }
  getHighlightedDot(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .graph-dot .outer-circle.selected`);
  }
  getMovableLine(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area [data-testid=movable-line]`);
  }
  getMovableLineEquationContainer(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area [data-testid=movable-line-equation-container-]`);
  }
  getMovableLineEquationSlope(workspaceClass) {
    return this.getMovableLineEquationContainer()
      .invoke('text')
      .then(text => text.match(/= *(\u2212?[0-9.]+)/)[1]) // unicode char is negative sign
      .then(str => parseFloat(str.replace('\u2212', '-')));
  }
  getMovableLineCover(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .movable-line-cover`);
  }
  // Specify which of the handles you want with argument: 'lower' or 'upper'
  // Or falsy arg to get all of them.
  getMovableLineHandle(position, workspaceClass) {
    if (position) {
      return cy.get(`${wsClass(workspaceClass)} .canvas-area .movable-line-${position}-handle`);
    } else {
      return cy.get(`${wsClass(workspaceClass)} .canvas-area .movable-line-handle`);
    }
  }
  getMovableLineWrapper(workspaceClass) {
    return this.getMovableLine(workspaceClass).parents('.adornment-wrapper');
  }
  getAxisLabel(place, workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .axis-label.${place}`);
  }
  getXAxisLabel(workspaceClass) {
    return this.getAxisLabel("bottom", workspaceClass);
  }
  getYAxisLabel(workspaceClass) {
    return this.getAxisLabel("left", workspaceClass);
  }
  getAxisInput(place, workspaceClass) {
    return this.getAxisLabel(place, workspaceClass).find(".input-textbox");
  }
  getXAxisInput(workspaceClass) {
    return this.getAxisInput("bottom", workspaceClass);
  }
  getYAxisInput(workspaceClass) {
    return this.getAxisInput("left", workspaceClass);
  }
  getLegendTitle(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .legend-title`);
  }
  getLayerName(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .layer-name`);
  }
  getLayerNameEditButton(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .layer-name button`);
  }
  getLayerNameInput(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .multi-legend .legend-row .layer-name input`);
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
  getPlottedVariablesGroup(workspaceClass) {
    return this.getAdornments("plotted-function", workspaceClass).find("g.plotted-variable");
  }
  getPlottedVariablesPoint(workspaceClass) {
    return this.getPlottedVariablesGroup(workspaceClass).find("circle.plotted-variable-value");
  }
  getPlottedVariablesPointHighlight(workspaceClass) {
    return this.getPlottedVariablesGroup(workspaceClass).find("circle.plotted-variable-highlight-value");
  }
  getPlottedVariablesLabel(workspaceClass) {
    return this.getPlottedVariablesGroup(workspaceClass).find("text.plotted-variable-label");
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
