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
  getAttrValueCell(tileIndex = 0, workspaceClass){
    const valueSelector = ".attribute-name-value-pair .value";
    return this.getTile(tileIndex, workspaceClass).find(`${valueSelector}`);
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
  getSortCards(tileIndex = 0, workspaceClass) {
    return this.getTile(tileIndex, workspaceClass).find(`.sortable.card`);
  }
  getSortCardHeading(tileIndex = 0, workspaceClass){
    return this.getTile(tileIndex, workspaceClass).find(`.sortable .heading`);
  }
  getSortCardCollapseToggle(tileIndex = 0, workspaceClass){
    const selector = ".expand-toggle-area button.expand-toggle";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getSortCardAttributes(card = 0, tileIndex = 0, workspaceClass){
    return this.getSortCards(tileIndex, workspaceClass).eq(card).find(`.attribute`);
  }
  getSortCardValues(card = 0, tileIndex = 0, workspaceClass) {
    return this.getSortCards(tileIndex, workspaceClass).eq(card).find('.value');
  }
  getSortCardData(tileIndex = 0, workspaceClass){
    const selector = ".sortable.expanded .attribute-value-row";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  getNavPanel(tileIndex = 0, workspaceClass) {
    const selector = ".panel.nav";
    return this.getTile(tileIndex, workspaceClass).find(selector);
  }
  getConfirmDeleteButton(tileIndex = 0, workspaceClass){
    const selector = ".button.modal-button.default";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`);
  }
  // Toolbar
  getToolbarButton(buttonClass, tileIndex, workspaceClass) {
    const selector = `.canvas-area .data-card-toolbar .${buttonClass}`;
    return cy.get(`${workspaceClass || ".primary-workspace"} ${selector}`).eq(tileIndex);
  }
  getDuplicateCardButton(tileIndex = 0, workspaceClass) {
    return this.getToolbarButton('duplicate-data-card-button', tileIndex, workspaceClass);
  }
  getLinkTileButton(tileIndex = 0, workspaceClass) {
    return this.getToolbarButton('link-tile-button', tileIndex, workspaceClass);
  }
  getLinkGraphButton(tileIndex = 0, workspaceClass) {
    return this.getToolbarButton('link-graph-button', tileIndex, workspaceClass);
  }
  getLinkGraphModalTileMenu() {
    const selector = ".ReactModalPortal .modal-content select[data-test=link-tile-select]";
    return cy.get(`${selector}`).eq(0);
  }
  getLinkGraphModalCreateNewButton() {
    const selector = ".ReactModalPortal .modal-footer button.add-new-button";
    return cy.get(`${selector}`).eq(0);
  }
  getLinkGraphModalLinkButton() {
    const selector = ".ReactModalPortal .modal-footer button.default";
    return cy.get(`${selector}`).eq(0);
  }
  getMergeDataButton(tileIndex = 0, workspaceClass) {
    return this.getToolbarButton('merge-data-button', tileIndex, workspaceClass);
  }
  getMergeDataModalSelect(tileIndex = 0){
    const selector = ".ReactModalPortal .modal-content .merge-data-select";
    return cy.get(`${selector}`).eq(tileIndex);
  }
  getMergeDataModalAddDataButton(tileIndex = 0){
    const selector = ".ReactModalPortal .modal-footer .modal-button.default";
    return cy.get(`${selector}`).eq(tileIndex);
  }
  getLinkTableButton(tileIndex = 0, workspaceClass) {
    return this.getToolbarButton('dataset-view-button', tileIndex, workspaceClass);
  }
  getDragHandle(cardIndex, workspaceClass, tileIndex = 0) {
    const selector = ".sort-area-grid .cell.stack .drag-handle svg";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`).eq(cardIndex);
  }
  getDropZone(cardIndex, workspaceClass, tileIndex = 0) {
    const selector = ".sort-area-grid .cell.stack .stack-drop-zone.show-droppable";
    return this.getTile(tileIndex, workspaceClass).find(`${selector}`).eq(cardIndex);
  }
  dragCardToStack(dragCard, dropStack) {
    this.getDragHandle(dragCard).click()
    .trigger("mousedown", {force:true});
    this.getDropZone(dropStack)
    .trigger('mousemove', {force:true })
    .trigger("mouseup", {force:true })
    .wait(1000);
  }
}
export default DataCardToolTile;
