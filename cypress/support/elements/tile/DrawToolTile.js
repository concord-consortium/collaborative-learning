class DrawToolTile{
    getDrawTile(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .drawing-tool-tile`);
    }
    getTileTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
    }
    getDrawTileComponent(){
      return cy.get('.primary-workspace [data-testid=drawing-tool]');
    }
    getDrawTileShowSortPanel(){
      return cy.get('.primary-workspace .drawing-tool .object-list');
    }
    getDrawTileShowSortPanelOpenButton(){
      return cy.get('.primary-workspace .drawing-tool .object-list.closed button');
    }
    getDrawTileShowSortPanelCloseButton(){
      return cy.get('.primary-workspace .drawing-tool .object-list.open button.close');
    }
    getDrawToolSelect(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.select');
    }
    getDrawToolFreehand(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.line');
    }
    getDrawToolVector(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.vector');
    }
    getDrawToolVectorSubmenu(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.vector .expand-collapse');
    }
    getDrawToolRectangle(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.rectangle');
    }
    getDrawToolEllipse(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.ellipse');
    }
    getDrawToolStamp(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.stamp');
    }
    getDrawToolStampExpand(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.stamp .expand-collapse');
    }
    getDrawToolText(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.text');
    }
    getDrawToolStrokeColor(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.stroke-color');
    }
    getDrawToolFillColor(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.fill-color');
    }
    getDrawToolVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.variable');
    }
    getDrawToolNewVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.new-variable');
    }
    getDrawToolInsertVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.insert-variable');
    }
    getDrawToolEditVariable(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.edit-variable');
    }
    getDrawToolUploadImage(){
      return cy.get('.primary-workspace .drawing-toolbar .upload-button-input');
    }
    getDrawToolGroup(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.group');
    }
    getDrawToolUngroup(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.ungroup');
    }
    getDrawToolDelete(){
      return cy.get('.primary-workspace .drawing-toolbar .toolbar-button.delete');
    }

    getFreehandDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg path');
    }
    getVectorDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg g.vector');
    }
    getRectangleDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg rect.rectangle');
    }
    getEllipseDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg ellipse');
    }
    getImageDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg image');
    }
    getTextDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg g.text');
    }
    getSelectionBox(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg [data-testid=selection-box]');
    }
    getHighlightBox(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg [data-testid=highlight-box]');
    }
    getVariableChip() {
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer .drawing-variable.variable-chip');
    }
    getGhostGroup() {
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg g.ghost');
    }
    getDrawTileTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .drawing-tool-tile .editable-tile-title`);
    }
    drawRectangle(x, y, width=25, height=25) {
      this.getDrawToolRectangle().last().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y)
        .trigger("pointermove", x+width, y+height)
        .trigger("pointerup", x+width, y+height);
    }

    drawEllipse(x, y, width=25, height=25) {
      this.getDrawToolEllipse().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y)
        .trigger("pointermove", x+width, y+height)
        .trigger("pointerup", x+width, y+height);
    }

    drawVector(x, y, width=25, height=25) {
      this.getDrawToolVector().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y)
        .trigger("pointermove", x+width, y+height)
        .trigger("pointerup", x+width, y+height);
    }

    addText(x, y, text) {
      this.getDrawToolText().click();
      this.getDrawTile().last()
        .trigger("pointerdown", x, y)
        .trigger("pointerup", x, y);
      this.getDrawTile().last()
        .trigger("pointerdown", x, y)
        .trigger("pointerup", x, y);
      this.getTextDrawing().last().get('textarea').type(text + "{enter}");
    }

}

export default DrawToolTile;
