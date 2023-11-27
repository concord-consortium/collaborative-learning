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
    return cy.get(`${wsClass(workspaceClass)} .simulator-tool-tile .emg-slider .rc-slider-rail`);
  }
  getSelectionButtons(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .selection-button`);
  }
}

export default SimulatorTile;
