function wsClass(wsc) {
  return wsc ?? ".primary-workspace";
}

class SimulatorTile {
  getSimulatorTile(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .canvas-area .simulator-tool-tile`);
  }
  getTileTitle(workspaceClass){
    return cy.get(`${wsClass(workspaceClass)} .simulator-tool-tile .editable-tile-title-text`);
  }
  getSimulatorTileTitle(workspaceClass){
    return cy.get(`${wsClass(workspaceClass)} .simulator-tool-tile .editable-tile-title`);
  }
  getAnimationImages(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .animation-image`);
  }
  getEMGSlider(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .simulator-tool-tile .emg-slider .rc-slider-step`);
  }
  getSelectionButtons(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .selection-button`);
  }
  getPotDial(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .pot-dial`);
  }
  getPotValueSlider(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .pot-slider .rc-slider-handle`);
  }
  getBoard(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .board`);
  }
  getServoArm(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .servo-arm`);
  }
  getExpandToggle(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .expand-toggle`);
  }
  getVariableDisplayedValue(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .display-value`);
  }
  getExtraNodesCount(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .extra-nodes-count`);
  }
}

export default SimulatorTile;
