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
  getNumberNodeOutput() {
    return cy.get(".flow-tool .node.number .node-output");
  }
  getModalOkButton() {
    return cy.get('.dialog-contents #okButton');
  }
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
    cy.get('.demo-output-image.grabber-cord-image').should("exist");
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

  // Record/Play/Pause/Stop/Clear
  getSamplingRateLabel() {
    return cy.get('.samplerate-label');
  }
  selectSamplingRate(rate) {
    return cy.get('#rate-select').select(rate);
  }
  verifyRecordButtonText() {
    cy.get(".primary-workspace .record-data-txt").should("have.text", "Record");
  }
  verifyRecordButtonIcon() {
    cy.get(".primary-workspace .record-data-icon path").invoke("attr", "data-name").should("contain", "record");
  }
  getRecordButton() {
    return cy.get(".primary-workspace .record-data-btn").contains("Record").parent();
  }
  verifyPlayButtonText() {
    cy.get(".primary-workspace .playback-data-txt").should("have.text", "Play");
  }
  verifyPlayButtonIcon() {
    cy.get(".primary-workspace .playback-data-icon path").invoke("attr", "data-name").should("contain", "run");
  }
  getPlayButton() {
    return cy.get(".primary-workspace .playback-data-btn").contains("Play").parent();
  }
  verifyPauseButtonText() {
    cy.get(".primary-workspace .playback-data-txt").should("have.text", "Pause");
  }
  verifyPauseButtonIcon() {
    cy.get(".primary-workspace .playback-data-icon path").invoke("attr", "data-name").should("contain", "pause");
  }
  getPauseButton() {
    return cy.get(".primary-workspace .playback-data-btn").contains("Pause").parent();
  }
  getTimeSlider() {
    return cy.get(".primary-workspace .program-editor-topbar .rc-slider.rc-slider-horizontal");
  }
  getCountdownTimer() {
    return cy.get(".primary-workspace .program-editor-topbar .countdown-timer");
  }
  verifyStopButtonText() {
    cy.get(".primary-workspace .record-data-txt").should("have.text", "Stop");
  }
  verifyStopButtonIcon() {
    cy.get(".primary-workspace .record-data-icon path").invoke("attr", "data-name").should("contain", "stop");
  }
  getStopButton() {
    return cy.get(".primary-workspace .record-data-btn").contains("Stop").parent();
  }
  verifyRecordingClearButtonText() {
    cy.get(".primary-workspace .record-data-txt").should("have.text", "Clear");
  }
  verifyRecordingClearButtonIcon() {
    cy.get(".primary-workspace .record-data-icon path").invoke("attr", "data-name").should("contain", "clear");
  }
  getRecordingClearButton() {
    return cy.get(".primary-workspace .record-data-btn").contains("Clear").parent();
  }
  getClearDataWarningTitle() {
    return cy.get(".modal-title");
  }
  getClearDataWarningContent() {
    return cy.get(".modal-content");
  }
  getClearDataWarningCancel() {
    return cy.get('.modal-button').contains("Cancel");
  }
  getClearDataWarningClear() {
    return cy.get('.modal-button').contains("Clear");
  }
}

export default DataflowToolTile;
