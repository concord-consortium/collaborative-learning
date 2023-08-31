class NumberlineTile {
  getNumberlineTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .numberline-tool-tile`);
  }
  getTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
  }
  getNumberlineTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
  }
}

export default NumberlineTile;
