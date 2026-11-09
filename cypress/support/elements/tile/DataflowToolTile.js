const getNodeText = (nodeType) => `.primary-workspace .node.${nodeType}`;

class DataflowToolTile {
  getDataflowTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .dataflow-tool-tile`);
  }
  getTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
  }
  getDataflowTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
  }
  getCreateNodeButton(nodeType) {
    return cy.get(`.primary-workspace [data-testid="add-${nodeType}-button"]`);
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
    return cy.get('.primary-workspace .input-socket');
  }
  getNodeOutput() {
    return cy.get('.primary-workspace .output-socket');
  }
  getNodeTitle(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .node .node-name-input`);
  }
  getNodeValueContainer(nodeType) {
    return this.getNode(nodeType).find(".value-container");
  }
  // QA-only "Clear program" button (class "qa"), distinct from the recording toolbar's Clear.
  getClearProgramButton() {
    return cy.get('.primary-workspace .qa');
  }
  getFlowtool() {
    return cy.get('.primary-workspace .flow-tool');
  }
  getTableItButton() {
    return cy.get(`.primary-workspace .dataflow-toolbar .toolbar-button.table-it`);
  }
  getRecordSampleButton() {
    return cy.get(`.primary-workspace .dataflow-toolbar .toolbar-button.record-sample`);
  }
  getZoomInButton() {
    return cy.get(`.primary-workspace .dataflow-toolbar .toolbar-button.zoom-in`);
  }
  getZoomOutButton() {
    return cy.get(`.primary-workspace .dataflow-toolbar .toolbar-button.zoom-out`);
  }
  verifyZoomIn(previousStyle) {
    this.getFlowtool().children().invoke("attr", "style").then(style => {
      let currentScale = this.getScaleFromStyle(style);
      let previousScale = this.getScaleFromStyle(previousStyle);
      expect(currentScale).to.be.greaterThan(previousScale);
    });
  }
  verifyZoomOut(previousStyle) {
    this.getFlowtool().children().invoke("attr", "style").then(style => {
      let currentScale = this.getScaleFromStyle(style);
      let previousScale = this.getScaleFromStyle(previousStyle);
      expect(currentScale).to.be.lessThan(previousScale);
    });
  }
  getScaleFromStyle(style) {
    let startIndex = style.indexOf("scale")+6;
    cy.log("startIndex:", startIndex);
    let endIndex = style.indexOf(")", startIndex);
    cy.log("endIndex:", endIndex);
    return Number(style.substring(startIndex, endIndex));
  }
  getNumberNodeOutput() {
    return cy.get(".primary-workspace .flow-tool .node.number .output-socket");
  }
  getLiveOutputNodeInput() {
    return cy.get(".primary-workspace .flow-tool .node.live-output .input-socket");
  }
  //Generator
  getAmplitudeField() {
    return cy.get(`${getNodeText("generator")} [title='Set Amplitude']`);
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
  getServoImages() {
    cy.get('.servo-assembly .servo-part.body').should("exist");
    cy.get('.servo-assembly .servo-part.arm').should("exist");
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
    return cy.get('.primary-workspace .samplerate-label');
  }
  selectSamplingRate(rate) {
    return cy.get('.primary-workspace #rate-select').select(rate);
  }
  getRecordButton() {
    return cy.get('.primary-workspace .tile-toolbar.dataflow-toolbar .toolbar-button.record');
  }
  getStopButton() {
    return cy.get('.primary-workspace .tile-toolbar.dataflow-toolbar .toolbar-button.stop');
  }
  getClearButton() {
    return cy.get('.primary-workspace .tile-toolbar.dataflow-toolbar .toolbar-button.clear');
  }
  getCountdownTimer(options={}) {
    return cy.get(".primary-workspace .program-editor-topbar .recording-elapsed", options);
  }
  getLinkTileButton() {
    return cy.get(".primary-workspace .link-table-button");
  }
  createProgram(programNodes) {
    this.getDataflowTile().should("exist");
    programNodes.forEach((node, i) => {
      this.getCreateNodeButton(node.name).click();
      this.getNode(node.name).should("exist");
      this.getNodeTitle().eq(i).invoke("val").should("include", node.title);
    });
    this.getNodeOutput().eq(0).click({force: true});
    this.getNodeInput().eq(0).click({force: true});
  }
  recordData(samplingRate, timer) {
    this.recordDataWithoutStop(samplingRate, timer);
    this.getStopButton().click();
  }
  recordDataWithoutStop(samplingRate, timer) {
    this.selectSamplingRate(samplingRate);
    this.getDataflowTile().click();     // the toolbar renders only for the selected tile
    this.getRecordButton().click();
    this.getCountdownTimer({timeout: (timer + 2) * 1000}).should("contain", "00:0" + timer.toString());
  }
  // No confirmation modal: Clear empties the table in place.
  clearRecordedData() {
    this.getDataflowTile().click();
    this.getClearButton().click();
  }
  // A title may be given as a RegExp: once a capture is prepared the program's name carries the
  // capture's start time (see captureName in dataflow-content), which no test can predict.
  checkTableTitle(tableTile, tableTitle) {
    if (tableTitle instanceof RegExp) {
      tableTile.getTableTitle().invoke("text").should("match", tableTitle);
    } else {
      tableTile.getTableTitle().should("have.text", tableTitle);
    }
  }
  checkLinkedTableRecordedData(tableTile, tableTitle, attributes, rows) {
    this.checkTableTitle(tableTile, tableTitle);
    tableTile.checkWorkspaceColumnHeaders(attributes);
    tableTile.checkTableColumnValues(2, rows, 1);
  }
  checkEmptyLinkedTable(tableTile, tableTitle, attributes) {
    this.checkTableTitle(tableTile, tableTitle);
    tableTile.checkWorkspaceColumnHeaders(attributes);
    tableTile.checkEmptyTableValues();
  }
  checkInitialStateButtons() {
    this.getSamplingRateLabel().should("have.text", "Sampling Rate");
    this.getRecordButton().should("not.have.attr", "aria-disabled");
    this.getStopButton().should("have.attr", "aria-disabled", "true");
  }
}

export default DataflowToolTile;
