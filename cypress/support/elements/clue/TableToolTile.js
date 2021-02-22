class TableToolTile{
    tableToolTile(workspaceClass){
        return `${workspaceClass || ".primary-workspace"} .canvas-area .table-tool-tile`;
    }
    getTableTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .table-tool`);
    }
    getRemoveRowButton(){
        return cy.get('[data-test=remove-row-button]');
    }
    renameColumn(column, title){
        cy.get('editable-header-cell').contains(column).dblclick().type(title);
    }
    removeRow(i){
      this.getRemoveRowButton().eq(i).click();
    }
    getTableRow(){
        return cy.get('.canvas-area .rdg-row');
    }
    getColumnHeaderText(){
        return cy.get('.ag-header-cell-text');
    }
    getTableCell(){
        return cy.get('.cdp-row-data-cell');
    }
    enterData(cell, num){
        this.getTableCell().eq(cell).type(num+'{enter}');
    }
    getTableIndexColumnCell(){
        return cy.get('.canvas-area .neo-codap-case-table .cdp-case-index-cell');
    }
    unlinkTable(){
        this.openTableMenu();
        cy.get('.bp3-menu-item div').contains('Unlink Geometry').click();
    }
}
export default TableToolTile;
