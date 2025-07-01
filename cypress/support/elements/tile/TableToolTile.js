function wsclass(workspaceClass) {
  return workspaceClass || ".primary-workspace";
}

class TableToolTile{
    getTableTile(workspaceClass) {
        return cy.get(`${wsclass(workspaceClass)} .canvas .table-tool`);
    }
    getTableTitle(workspaceClass){
      return cy.get(`${wsclass(workspaceClass)} .canvas .table-title`);
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
      return cy.get('.canvas .rdg-row');
    }
    getSelectedRow(workspaceClass) {
      return cy.get(`${wsclass(workspaceClass)} .canvas .rdg-row.highlighted`);
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
    // Note, the editor is in a portal at the document level.
    // This method will not work if you are in a narrower "within" context.
    getTableCellEdit(){
        return cy.get('.rdg-text-editor');
    }
    typeInTableCellXY(row, col, text) {
      this.getTableCellXY(row, col).click({ scrollBehavior: false }).should('have.attr', 'aria-selected', 'true');
      cy.wait(100);
      this.getTableCellXY(row, col).click({ scrollBehavior: false });
      cy.wait(100);
      return cy.document().within(() => {
        this.getTableCellEdit().type(`${text}{enter}`, { scrollBehavior: false });
      });
    }
    typeInTableCell(i, text, confirm=true) {
      const confirmation = confirm ? '{enter}' : '';
      this.getTableCell().eq(i).click({ scrollBehavior: false }).should('have.attr', 'aria-selected', 'true');
      cy.wait(100);
      this.getTableCell().eq(i).click({ scrollBehavior: false });
      return cy.document().within(() => {
        this.getTableCellEdit().type(`${text}${confirmation}`, { scrollBehavior: false });
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
        return this.getTableTile().find('.index-cell-contents');
    }
    // Fill in a table tile with the given data (a list of lists)
    // Table tile should in the default state (2 columns, no rows)
    fillTable($tile, data) {
      // at least two cols, or as many as the longest row in the data array
      const cols = Math.max(2, ...data.map(row => row.length));
      $tile.within((tile) => {
        // tile will start with two columns; make more if desired
        for (let i=2; i<cols; i++) {
          this.getAddColumnButton().click();
        }
        for (let i=0; i<data.length; i++) {
          for (let j=0; j<data[i].length; j++) {
            const cellContent = data[i][j];
            this.typeInTableCellXY(i, j, cellContent);
            this.getTableCellXY(i, j).should('contain', cellContent);
          }
        }
      });
    }

    addRowToTable($tile, rowIndex, data) {
      $tile.within(() => {
        for (let j=0; j<data.length; j++) {
          this.typeInTableCellXY(rowIndex, j, data[j]);
        }
      });
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
      this.getTableCellWithRowColIndex(0, 2).should('have.text', '');
      this.getTableCellWithRowColIndex(0, 3).should('have.text', '');
    }

    // Row reordering helper methods
    getRowDragIndicator() {
      return cy.get('[data-testid="row-drag-indicator"]');
    }

    getRowDividers() {
      return cy.get('[data-testid^="row-divider-"]');
    }

    getRowDividerBefore(rowId) {
      return cy.get(`[data-testid="row-divider-${rowId}-before"]`);
    }

    getRowDividerAfter(rowId) {
      return cy.get(`[data-testid="row-divider-${rowId}-after"]`);
    }

    getRowIndexLabels() {
      return cy.get('.row-index-label');
    }

    getDragOverlayRow() {
      return cy.get('.drag-overlay-row');
    }

    getDragOverlayCell() {
      return cy.get('.drag-overlay-cell');
    }

    getIndexCellWrapper() {
      return cy.get('.index-cell-wrapper');
    }

    getIndexCellContents() {
      return cy.get('.index-cell-contents');
    }

    hoverOverRow(rowIndex) {
      return this.getIndexCellWrapper().eq(rowIndex).trigger('mouseover');
    }

    unhoverFromRow(rowIndex) {
      return this.getIndexCellWrapper().eq(rowIndex).trigger('mouseout');
    }

    verifyRowDragIndicatorVisible() {
      this.getRowDragIndicator().should('exist');
    }

    verifyRowDragIndicatorHidden() {
      this.getRowDragIndicator().should('have.css', 'opacity', '0');
    }

    verifyRowDividersExist() {
      this.getRowDividers().should('exist');
    }

    verifyRowDividersHidden() {
      cy.get('.row-divider').should('have.css', 'visibility', 'hidden');
    }

    verifyRowIndexLabelsExist() {
      this.getRowIndexLabels().should('exist');
    }

    verifyRowIndexLabelsNotExist() {
      this.getRowIndexLabels().should('not.exist');
    }

    verifyGrabCursor() {
      this.getIndexCellContents().should('have.css', 'cursor', 'grab');
    }

    verifyTableAccessibility() {
      cy.get('.table-tool').should('have.attr', 'role', 'grid');
      cy.get('.rdg-row').should('have.attr', 'role', 'row');
      cy.get('.rdg-cell').should('have.attr', 'role', 'gridcell');
    }
}
export default TableToolTile;
