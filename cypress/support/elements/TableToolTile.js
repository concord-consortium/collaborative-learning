class TableToolTile{
    tableToolTile(){
        return '.neo-codap-case-table'
    }
    getTableTile(){
        return cy.get(this.tableToolTile());
    }

    getRemoveRowMenuItem(){
        return cy.get('[data-test=remove-row-menu-item]')
    }

    openTableMenu(){
        cy.get('.canvas-area .neo-codap-case-table .cdp-case-index-header .bp3-popover-target' ).click();
    }
    addNewRow(){
        this.openTableMenu();
        cy.get('.bp3-menu-item div').contains('New Row').click()
        // cy.get('[data-test=new-row-menu-item]').click();
    }
    renameColumn(column, title){
        this.openRenameColumnDialog(column);
        // cy.get('[data-test=rename-column-menu-item]').click().click();
        // cy.get('[data-test=attr-menu-item]').contains(column).click();
        this.renameColumnDialog(title);
    }
    removeRows(i){
        cy.get('[row-index='+i+']').first().click({force:true});
        this.openTableMenu();
        cy.get('.bp3-menu-item div').contains('Remove Rows').click()
        // cy.get('[data-test=remove-row-menu-item]').click()
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
        cy.get('.bp3-menu-item div').contains('Rename Column').click().click();//.siblings('span.bp3-icon-caret-right').click().click()
        cy.wait(500)
        cy.get('.bp3-menu-item div').contains(column).click();
        // cy.get('[data-test=rename-column-menu-item]').click().click();
        // cy.get('[data-test=attr-menu-item]').contains(column).click();
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
    getTableIndexColumnCell(){
        return cy.get('.canvas-area .neo-codap-case-table .cdp-case-index-cell')
    }
}
export default TableToolTile;