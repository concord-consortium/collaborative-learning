function wsclass(workspaceClass) {
  return workspaceClass || ".primary-workspace";
}

class TableToolTile{
    getTableTile(workspaceClass) {
        return cy.get(`${wsclass(workspaceClass)} .canvas-area .table-tool`);
    }
    getTableTitle(workspaceClass){
      return cy.get(`${wsclass(workspaceClass)} .canvas-area .table-title`);
    }
    getAddColumnButton(){
      return cy.get('.add-column-button');
    }
    getRemoveColumnButton(){
      return cy.get('.remove-column-button');
    }
    getIndexNumberToggle(workspaceClass){
      return cy.get(`${wsclass(workspaceClass)} .show-hide-row-labels-button`);
    }
    getRemoveRowButton(){
        return cy.get('[data-test=remove-row-button]');
    }
    getColumnHeader(){
      return cy.get('.column-header-cell .editable-header-cell');
    }
    getSelectedColumnHeaders(workspaceClass) {
      return cy.get(`${wsclass(workspaceClass)} .selected-column .column-header-cell`);
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
    /**
     * Get table cell at the given coordinates.
     * row and col arguments count from 0,0 at the top left,
     * not including the header row or the label column
     */
    getTableCellXY(row, col) {
      // header/label have rowindex=1 and colindex=1; the data cells start from 2.
      const rowindex = row+2, colindex = col+2;
      return cy.get(`.rdg-row[aria-rowindex=${rowindex}] .rdg-cell[aria-colindex=${colindex}]`);
    }
    getTableCellContent(cellIndex) {
      return this.getTableCell().eq(cellIndex).find('.cell');
    }
    getTableCellEdit(){
      return cy.get('.rdg-row .rdg-cell .rdg-text-editor');
    }
    typeInTableCellXY(row, col, text) {
      this.getTableCellXY(row, col).dblclick().then(() => {
        this.getTableCellEdit().type(`${text}{enter}`);
      });
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
    createNewLinkedGraph() {
      this.getTableTile().click();
      cy.get('.toolbar-button.link-graph').click();
      this.getLinkGraphModalTileMenu().select('New Graph');
      this.getLinkGraphModalLinkButton().click();
    }
    createNewDatacard() {
      this.getTableTile().click();
      cy.get('.toolbar-button.data-set-view').click();
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
