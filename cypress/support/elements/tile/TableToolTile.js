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
    getTableTitleInput(workspaceClass){
      return cy.get(`${wsclass(workspaceClass)} .canvas .table-title input`);
    }
    enterTableTitle(title, workspaceClass){
      // Wait briefly so rdg's mount-time auto-focus finishes before we click —
      // otherwise the title click can race with rdg's `shouldFocusGrid` self-focus
      // and edit mode never opens. The chained `.type()` re-queries the input
      // separately so React 18's state-update batching can't race ahead of the
      // input mounting.
      cy.wait(300);
      this.getTableTitle(workspaceClass).realClick();
      this.getTableTitleInput(workspaceClass).type(`${title}{enter}`);
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
      // EditableHeaderCell.handleClick gates edit-mode on the column already being
      // selected: the first click selects, a subsequent click enters edit. cypress's
      // `.dblclick()` fires both click events too quickly for React 18 to flush the
      // selection state between them, so the second click still sees "not selected"
      // and the editor never opens. Two separate `.click()` invocations give React a
      // commit between them. (CLUE-521 covers the underlying UX wart in production.)
      this.getColumnHeader().contains(column).click();
      this.getColumnHeader().contains(column).click();
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
      // In react-data-grid beta.44, a double-click on a cell calls
      // `selectCellWrapper(true)` which enters EDIT mode. (CODAPv3, which uses
      // the same rdg version, takes the same approach in its case-table specs.)
      // The previous focus-sink-based approach no longer applies because beta.44
      // only renders `.rdg-focus-sink` for tree grids.
      this.getTableCellXY(row, col).dblclick({ scrollBehavior: false });
      cy.wait(100); // wait for the editor to mount
      cy.document().within(() => {
        this.getTableCellEdit().type(`${text}{enter}`, { scrollBehavior: false });
      });
    }
    typeInTableCell(i, text, confirm=true) {
      const confirmation = confirm ? '{enter}' : '';
      // Same beta.44 dblclick-to-edit pattern as `typeInTableCellXY` above.
      this.getTableCell().eq(i).dblclick({ scrollBehavior: false });
      cy.wait(100); // wait for the editor to mount
      return cy.document().within(() => {
        this.getTableCellEdit().type(`${text}${confirmation}`, { scrollBehavior: false });
      });
    }
    typeExpressionInDialog(expression) {
      cy.get('[data-testid="formula-editor-input"] [role="textbox"]')
        .click()
        // realType is needed because codemirror doesn't handle the simulated key events
        // that cypress sends with a plain type command.
        .realType(expression);
    }
    getTableCellWithColIndex(colIndex, colValue){
        return cy.get('.rdg-row').contains('.rdg-cell[aria-colindex="' + colIndex + '"]', colValue);
        // return cy.get('.rdg-row .rdg-cell[aria-colindex=\"' + colIndex + '\"]');
    }
    getTableCellWithRowColIndex(rowIndex, colIndex){
      // rdg beta.44 virtualizes off-screen rows, so a row past the visible window
      // isn't in the DOM and `.eq(rowIndex)` won't find it. Scroll the grid so the
      // target row index will be inside the rendered window, then query by the
      // absolute `aria-rowindex` instead of `.eq` (which is relative to whatever
      // rows happen to be rendered right now). aria-rowindex matches the data
      // row index +2 (header occupies rowindex 1).
      cy.get('.rdg').then($rdg => {
        const grid = $rdg[0];
        // Use the actual rendered row height when available; fall back to a sensible
        // default. Centering the target in the viewport gives rdg's buffer room on
        // both sides so the row is rendered after the scroll.
        const sample = grid.querySelector('.rdg-row');
        const rowHeight = (sample && sample.getBoundingClientRect().height) || 30;
        grid.scrollTop = Math.max(0, rowIndex * rowHeight - grid.clientHeight / 2);
      });
      return cy.get(`.rdg-row[aria-rowindex=${rowIndex + 2}] .rdg-cell[aria-colindex="${colIndex}"]`);
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
      cy.wait(10); // A brief wait can avoid a race issue with a newly created table
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

    getImportDataButton() {
      return cy.get('.toolbar-button.import-data');
    }
    importData(filename) {
      return cy.get('input[type="file"]').attachFile(filename);
    }
}
export default TableToolTile;
