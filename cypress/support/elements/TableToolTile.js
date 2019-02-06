class TableToolTile{
    getTableToolTile(){
        return cy.get('.neo-codap-case-table');
    }
    openTableMenu(){
        cy.get('.canvas-area .neo-codap-case-table .cdp-case-index-header').click();
    }
    addNewRow(){
        this.openTableMenu();
        cy.get('.nc-table-menu-popover div').contains('New Row').click();
    }
    renameColumnX(){
        this.openTableMenu();
        cy.get('.nc-table-menu-popover div').contains('Rename Column').click();
        cy.get('.bp3-overlay-open div').contains('x').click();
    }
    renameColumnY(){
        this.openTableMenu();
        cy.get('.nc-table-menu-popover div').contains('Rename Column').click();
        cy.get('.bp3-overlay-open div').contains('y').click();
    }
    getRemoveRowsMenuItem(){
        this.openTableMenu();
        return cy.get('.nc-table-menu-popover div').contains('Remove Rows').click();
    }
    removeRows(i){
        cy.get('.ag-row:nth-child('+i+')').click();
        this.getRemoveRowsMenuItem().click();
    }
    getTableRows(){
        return cy.get('.canvas-area .ag-center-cols-container .ag-row');
    }

}
export default TableToolTile;