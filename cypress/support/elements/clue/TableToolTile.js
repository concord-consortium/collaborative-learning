class TableToolTile{
    getTableTile(workspaceClass) {
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .table-tool`);
    }
    getTableTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .table-title`);
    }
    getAddColumnButton(){
      return cy.get('.add-column-button');
    }
    getRemoveColumnButton(){
      return cy.get('.remove-column-button');
    }
    getIndexNumberToggle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .show-hide-row-labels-button`);
    }
    getRemoveRowButton(){
        return cy.get('[data-test=remove-row-button]');
    }
    getColumnHeader(){
      return cy.get('.column-header-cell .editable-header-cell');
    }
    getWorkspaceColumnHeader(){
      return cy.get('.primary-workspace .column-header-cell .editable-header-cell');
    }
    renameColumn(column, title){
      this.getColumnHeader().contains(column).dblclick();
      cy.get('.column-header-cell .editable-header-cell input').type(title+'{enter}');
    }
    removeRow(i){
      this.getTableRow().eq(i).click();
      this.getRemoveRowButton().click();
    }
    getTableRow(){
      return cy.get('.canvas-area .rdg-row');
    }
    getColumnHeaderText(i){
      return cy.get('.column-header-cell .editable-header-cell .header-name').text();
    }
    getTableCell(){
      return cy.get('.rdg-row .rdg-cell');
    }
    getTableCellEdit(){
      return cy.get('.rdg-row .rdg-cell .rdg-text-editor');
    }
    typeInTableCell(i, text) {
      this.getTableCell().eq(i).dblclick().then(() => {
        this.getTableCellEdit().type(`${text}{enter}`);
      });
    }
    getTableCellWithColIndex(colIndex, colValue){
        return cy.get('.rdg-row').contains('.rdg-cell[aria-colindex="' + colIndex + '"]', colValue);
        // return cy.get('.rdg-row .rdg-cell[aria-colindex=\"' + colIndex + '\"]');
    }
    getTableCellWithRowColIndex(rowIndex, colIndex){
      return cy.get('.rdg-row').eq(rowIndex).find('.rdg-cell[aria-colindex="' + colIndex + '"]');
    }
    enterData(cell, num){
        this.getTableCell().eq(cell).type(num+'{enter}');
    }
    getTableIndexColumnCell(){
        return cy.get('.canvas-area .rdg-cell.index-column');
    }
    getLinkGraphButton(){
      return cy.get('.link-tile-button');
    }
    getLinkGraphModalCreateNewButton() {
      const selector = ".ReactModalPortal .modal-footer button.add-new-button";
      return cy.get(`${selector}`).eq(0);
    }
    getLinkGraphModalLinkButton() {
      const selector = ".ReactModalPortal .modal-footer button.default";
      return cy.get(`${selector}`).eq(0);
    }
    getLinkGraphModalTileMenu() {
      const selector = ".ReactModalPortal .modal-content select[data-test=link-tile-select]";
      return cy.get(`${selector}`).eq(0);
    }
    linkTable(table, graph) {
      cy.get('.table-title').text().contains(table).within((tableTile)=>{
        this.getLinkGraphButton().eq(table).click();
        cy.get('select').select(graph);
        cy.get('.modal-button').contains("Link Table").click();
      });
    }
    checkWorkspaceColumnHeaders(attributes) {
      this.getWorkspaceColumnHeader().should("have.length", attributes.length);
      attributes.forEach((attributeName, index) => {
        this.getWorkspaceColumnHeader().eq(index).should("have.text", attributeName);
      });
    }
    checkTableColumnValues(columnIndex, rows) {
      this.getTableRow().should("have.length.least", rows);
      for(let rowIndex = 0; rowIndex < rows; rowIndex++) {
        this.getTableCellWithRowColIndex(rowIndex, columnIndex).should("have.text", rowIndex.toString());
      }
    }
    checkEmptyTableValues() {
      this.getTableCellWithRowColIndex(0, 2).should("have.text", "");
      this.getTableCellWithRowColIndex(0, 3).should("have.text", "");
    }
}
export default TableToolTile;
