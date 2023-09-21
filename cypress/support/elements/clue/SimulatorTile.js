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
  getEMGSlider(workspaceClass) {
    return cy.get(`${wsClass(workspaceClass)} .simulator-tool-tile .emg-slider .rc-slider-rail`);
  }
}

export default SimulatorTile;
