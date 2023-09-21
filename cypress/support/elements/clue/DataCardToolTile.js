class DataCardToolTile {
  getTiles(workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .data-card-tool-tile`);
  }
  getTile(tileIndex = 0, workspaceClass) {
    return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .data-card-tool-tile`).eq(tileIndex);
  }
  getTileTitle(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.editable-title-text`);
  }
  getSortSelect(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.sort-select-input`);
  }
  getAttrs(tileIndex, workspaceClass) {
    const nameSelector = ".attribute-name-value-pair .name";
    return this.getTile(tileIndex, workspaceClass).find(`${nameSelector}`);
  }
  getAttrName(tileIndex = 0, workspaceClass){
    const nameSelector = ".attribute-name-value-pair .name";
    return this.getTile(tileIndex, workspaceClass).find(`${nameSelector}`);
  }
  getAttrValue(tileIndex = 0, workspaceClass){
    const valueSelector = ".attribute-name-value-pair .value input";
    return this.getTile(tileIndex, workspaceClass).find(`${valueSelector}`);
  }
  getAttrValueInput(tileIndex = 0, workspaceClass){
    const valueSelector = ".attribute-name-value-pair .value .value-input";
    return this.getTile(tileIndex, workspaceClass).find(`${valueSelector}`);
  }
  getDownshiftOptions(tileIndex = 0, workspaceClass){
    const optionsSelector = ".downshift-dropdown ul li";
    return this.getTile(tileIndex, workspaceClass).find(`${optionsSelector}`);
  }
  getSingleCardView(tileIndex = 0, workspaceClass){
    const selector = ".single-card-data-area";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getSortView(tileIndex = 0, workspaceClass){
    const selector = ".sorting-cards-data-area";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getSortMenuItems(tileIndex = 0, workspaceClass){
    const itemsSelector = ".sort-select-input > option";
    return this.getTile(tileIndex, workspaceClass).find(`${itemsSelector}`);
  }
  getAddCardButton(tileIndex = 0, workspaceClass){
    const selector = ".add-remove-card-buttons .add-card";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getAddAttributeButton(tileIndex = 0, workspaceClass){
    const selector = ".add-field";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getDeleteCardButton(tileIndex = 0, workspaceClass){
    const selector = ".add-remove-card-buttons .remove-card";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getCardNofTotalListing(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.card-number-of-listing`);
  }
  getNextCardButton(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.card-nav.next`);
  }
  getPreviousCardButton(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.card-nav.previous`);
  }
  getSortCardHeading(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.sortable .heading`);
  }
  getSortCardCollapseToggle(tileIndex = 0, workspaceClass){
    const selector = ".expand-toggle-area button.expand-toggle";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getSortCardData(tileIndex = 0, workspaceClass){
    const selector = ".sortable.expanded .attribute-value-row";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getConfirmDeleteButton(tileIndex = 0, workspaceClass){
    const selector = ".button.modal-button.default";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getMergeDataButton(tileIndex = 0, workspaceClass){
    const selector = ".canvas-area .data-card-toolbar .merge-data-button";
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`).eq(tileIndex);
  }
  getMergeDataModalSelect(tileIndex = 0){
    const selector = ".ReactModalPortal .modal-content .merge-data-select";
    return cy.get(`${selector}`).eq(tileIndex);
  }
  getMergeDataModalAddDataButton(tileIndex = 0){
    const selector = ".ReactModalPortal .modal-footer .modal-button.default";
    return cy.get(`${selector}`).eq(tileIndex);
  }
}
export default DataCardToolTile;
