class DataCardToolTile {
  getTile(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .data-card-tool-tile`);
  }
  getTileTitle(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .editable-data-card-title-text`);
  }
  getSortSelect(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .sort-select-input`);
  }
  getNameInputAsInactive(workspaceClass){
    const nameInputSelector = ".attribute-name-value-pair .name";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${nameInputSelector}`);
  }
}
export default DataCardToolTile;
