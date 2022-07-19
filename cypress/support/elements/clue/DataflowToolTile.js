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
}

export default DataflowToolTile;
