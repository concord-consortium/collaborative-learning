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
    const nameSelector = ".attribute-name-value-pair .name";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${nameSelector}`);
  }
  getValueInputAsInactive(workspaceClass){
    const valueSelector = ".attribute-name-value-pair .value";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${valueSelector}`);
  }
}
export default DataCardToolTile;
