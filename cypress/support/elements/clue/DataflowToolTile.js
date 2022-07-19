class DataflowToolTile {
  getDrawTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .dataflow-tool-tile`);
  }
  getCreateNodeButton(nodeType) {
    return cy.get(`.primary-workspace .icon-block.${nodeType}`);
  }
  getNode(nodeType) {
    return cy.get(`.primary-workspace .node.${nodeType}`);
  }
  getShowGraphButton(nodeType) {
    return cy.get(`.primary-workspace .node.${nodeType} .graph-button`);
  }
  getMinigraph(nodeType) {
    return cy.get(`.primary-workspace .node.${nodeType} .node-graph`);
  }
  getDeleteNodeButton(nodeType) {
    return cy.get(`.primary-workspace .node.${nodeType} .close-node-button`);
  }
  getDropdown(nodeType, dropdown) {
    return cy.get(`.primary-workspace .node.${nodeType} .node-select.${dropdown}`);
  }
  getDropdownOptions(nodeType, dropdown) {
    return cy.get(`.primary-workspace .node.${nodeType} .option-list.${dropdown}`);
  }
  getNumberField() {
    return cy.get(`.primary-workspace .node.number .number-input`);
  }
}

export default DataflowToolTile;
