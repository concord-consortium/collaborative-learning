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
  getAttrName(workspaceClass){
    const nameSelector = ".attribute-name-value-pair .name";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${nameSelector}`);
  }
  getAttrValue(workspaceClass){
    const valueSelector = ".attribute-name-value-pair .value";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${valueSelector}`);
  }
  getAttrValueInput(workspaceClass){
    const valueSelector = ".attribute-name-value-pair .value .value-input";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${valueSelector}`);
  }
  getSingleCardView(workspaceClass){
    const selector = ".data-card-tool-tile .single-card-data-area";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
  getSortView(workspaceClass){
    const selector = ".data-card-tool-tile .sorting-cards-data-area";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
  getSortMenuItems(workspaceClass){
    const itemsSelector = ".sort-select-input > option";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${itemsSelector}`);
  }
  getAddCardButton(workspaceClass){
    const selector = ".add-remove-card-buttons .add-card";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
  getDeleteCardButton(workspaceClass){
    const selector = ".add-remove-card-buttons .remove-card";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
  getCardNofTotalListing(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .card-number-of-listing`);
  }
  getNextCardButton(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .card-nav.next`);
  }
  getPreviousCardButton(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .card-nav.previous`);
  }
  getSortCardHeading(workspaceClass){
    return cy.get(`${workspaceClass || ".primary-workspace"} .sortable .heading`);
  }
  getSortCardCollapseToggle(workspaceClass){
    const selector = ".expand-toggle-area button.expand-toggle";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
  getSortCardData(workspaceClass){
    const selector = ".sortable.expanded .attribute-value-row";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
  getConfirmDeleteButton(workspaceClass){
    const selector = ".button.modal-button.default";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`);
  }
}
export default DataCardToolTile;
