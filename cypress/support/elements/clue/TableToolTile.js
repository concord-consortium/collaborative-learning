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
    renameColumn(column, title){
        this.getColumnHeader().contains(column).dblclick().type(title+'{enter}');
    }
    removeRow(i){
      this.getTableRow().eq(i).click();
      this.getRemoveRowButton().click();
    }
    getTableRow(){
        return cy.get('.canvas-area .rdg-row');
    }
    getColumnHeaderText(i){
        return this.getColumnHeader().text();
    }
    getTableCell(){
        return cy.get('.rdg-row .rdg-cell');
    }
    enterData(cell, num){
        this.getTableCell().eq(cell).type(num+'{enter}');
    }
    getTableIndexColumnCell(){
        return cy.get('.canvas-area .rdg-cell.index-column');
    }
    getLinkGraphButton(){
      return cy.get('.link-geometry-button');
    }
    linkTable(table, graph) {
      cy.get('.table-title').text().contains(table).within((tableTile)=>{
        this.getLinkGraphButton().eq(table).click();
        cy.get('select').select(graph);
        cy.get('.modal-button').contains("Link Table").click();
      });
    }
    getTableToolbarButton(button){// ['set-expression']
      return cy.get(`.primary-workspace .table-toolbar .toolbar-button.${button}`);
    }
}
export default TableToolTile;
