const getNodeText = (nodeType) => `.primary-workspace .node.${nodeType}`;

class DataflowToolTile {
  getDrawTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .dataflow-tool-tile`);
  }
  getCreateNodeButton(nodeType) {
    return cy.get(`.primary-workspace .icon-block.${nodeType}`);
  }
  getNode(nodeType) {
    return cy.get(getNodeText(nodeType));
  }
  getShowGraphButton(nodeType) {
    return cy.get(`${getNodeText(nodeType)} .graph-button`);
  }
  getMinigraph(nodeType) {
    return cy.get(`${getNodeText(nodeType)} .node-graph`);
  }
  getDeleteNodeButton(nodeType) {
    return cy.get(`${getNodeText(nodeType)} .close-node-button`);
  }
  getDropdown(nodeType, dropdown) {
    return cy.get(`${getNodeText(nodeType)} .node-select.${dropdown}`);
  }
  getDropdownOptions(nodeType, dropdown) {
    return cy.get(`${getNodeText(nodeType)} .option-list.${dropdown} .item`);
  }
  getNumberField() {
    return cy.get(`${getNodeText("number")} .number-input`);
  }
  getSerialConnectionButton(){
    return cy.get('.icon-serial');
  }
  getSerialMessage(){
    return cy.get('.serial-message');
  }
}

export default DataflowToolTile;
