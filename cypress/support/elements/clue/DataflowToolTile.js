const getNodeText = (nodeType) => `.primary-workspace .node.${nodeType}`;

class DataflowToolTile {
  getDataflowTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .dataflow-tool-tile`);
  }
  getTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
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
  getShowZoomInButton(nodeType){
    return cy.get(`${getNodeText(nodeType)} .plus`);
  }
  getShowZoomOutButton(nodeType){
    return cy.get(`${getNodeText(nodeType)} .minus`);
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
  getNodeInput() {
    return cy.get('.socket.input.number-value');
  }
  getNodeOutput() {
    return cy.get('.socket.output.number-value');
  }
  getNodeTitle(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .node-title`);
  }
  getClearButton() {
    return cy.get('.primary-workspace .qa');
  }
  getFlowtool() {
    return cy.get('.primary-workspace .flow-tool');
  }
  getZoomInButton() {
    return cy.get(`.primary-workspace [title='Zoom In']`);
  }
  getZoomOutButton() {
    return cy.get(`.primary-workspace [title='Zoom Out']`);
  }

  //Dataflow Tile

  getDataflowTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
  }
  //Generator
  getAmplitudeField() {
    return cy.get(`${getNodeText("generator")} [title='Set Amplitude']`);
  }

  //Timer
  getLabel(value) {
    return cy.get(`${getNodeText("timer")} [title='Set Time ${value}'] label`);
  }

  //Demo Output
  getAdvancedGrabberImages() {
    cy.get('.demo-output-image.grabber-paddle-image').should("exist");
    cy.get('.demo-output-image.grabber-chord-image').should("exist");
    cy.get('.demo-output-image.advanced-grabber-image').should("exist");
  }
  getGrabberImage() {
    cy.get('.demo-output-image.grabber-image').should("exist");
  }
  getLightBulbImage() {
    cy.get('.demo-output-image.lightbulb-image').should("exist");
  }
  getOutputNodeValueText() {
    return cy.get('[title="Display for nodeValue"]');
  }
  getOutputTiltValueText() {
    return cy.get('[title="Display for tilt"]');
  }

  //Sensor
  getSensorDropdownOptions(nodeType) {
    return cy.get(`${getNodeText(nodeType)} .option-list .item`);
  }

}

export default DataflowToolTile;
