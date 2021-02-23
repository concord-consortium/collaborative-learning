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
    getIndexNumberToggle(){
      cy.get('.show-hide-row-labels-button');
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
      this.getRemoveRowButton().eq(i).click();
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
        return cy.get('.canvas-area .rdg-cell .index-column');
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
      return cy.get(`.table-toolbar .toolbar-button.${button}`);
    }
    // unlinkTable(){ //the only way to unlink is to delete either the graph or the table
    //     cy.get('.bp3-menu-item div').contains('Unlink Geometry').click();
    // }
}
export default TableToolTile;
