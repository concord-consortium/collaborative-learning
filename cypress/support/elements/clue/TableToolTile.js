class TableToolTile{
    getTableTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .table-tool`);
    }
    getRemoveRowButton(){
        return cy.get('[data-test=remove-row-button]');
    }
    renameColumn(column, title){
        cy.get('.editable-header-cell').contains(column).dblclick().type(title);
    }
    removeRow(i){
      this.getRemoveRowButton().eq(i).click();
    }
    getTableRow(){
        return cy.get('.canvas-area .rdg-row');
    }
    getColumnHeaderText(){
        return cy.get('.editable-header-cell').text();
    }
    getTableCell(){
        return cy.get('.rdg-cell');
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
      cy.get('/table-title').text().contains(table).within((tableTile)=>{
        this.getLinkGraphButton().eq(table).click();
        cy.get('select').select(graph);
      });
    }
    unlinkTable(){
        cy.get('.bp3-menu-item div').contains('Unlink Geometry').click();
    }
}
export default TableToolTile;
