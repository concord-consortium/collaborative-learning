class TableToolTile{
    tableToolTile(){
        return '.neo-codap-case-table'
    }
    getTableToolTile(){
        return cy.get(this.tableToolTile());
    }

    getRemoveRowMenuItem(){
        return cy.get('[data-test=remove-row-menu-item]')
    }

    openTableMenu(){
        cy.get('.canvas-area .neo-codap-case-table .cdp-case-index-header').click();
    }
    addNewRow(){
        this.openTableMenu();
        cy.get('[data-test=new-row-menu-item]').click();
    }
    renameColumn(column, title){
        this.openTableMenu();
        cy.get('[data-test=rename-column-menu-item]').click().click();
        cy.get('[data-test=attr-menu-item]').contains(column).click();
        this.renameColumnDialog(title);
    }
    removeRows(i){
        cy.get('[row-index='+i+']').first().click({force:true});
        this.openTableMenu();
        cy.get('[data-test=remove-row-menu-item]').click()
    }
    getTableRow(){
        return cy.get('.canvas-area .ag-center-cols-container .ag-row');
    }
    renameColumnDialog(title){
        cy.get('.bp3-heading').should('contain', 'Rename Column');
        cy.get('.nc-attribute-name-input').clear();
        cy.get('.nc-attribute-name-input').type(title);
        this.getRenameColumnDialogButton('OK').click();
    }
    openRenameColumnDialog(column){ //used for testing cancel of dialog
        this.openTableMenu();
        cy.get('[data-test=rename-column-menu-item]').click().click();
        cy.get('[data-test=attr-menu-item]').contains(column).click();
    }
    getRenameColumnDialogButton(button){
        return cy.get('.nc-dialog-buttons span').contains(button);
    }
    getColumnHeaderText(){
        return cy.get('.ag-header-cell-text');
    }
    getTableCell(){
        return cy.get('.cdp-row-data-cell');
    }
}
export default TableToolTile;