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
    getDrawToolSelect(){
      return cy.get('.primary-workspace .drawing-tool-button.button-select');
    }
    getDrawToolFreehand(){
      return cy.get('.primary-workspace .drawing-tool-button.button-line');
    }
    getDrawToolVector(){
      return cy.get('.primary-workspace .drawing-tool-button.button-vector');
    }
    getDrawToolVectorSubmenu(){
      return cy.get('.primary-workspace .drawing-tool-button.button-vector .expand-collapse');
    }
    getDrawToolRectangle(){
      return cy.get('.primary-workspace .drawing-tool-button.button-rectangle');
    }
    getDrawToolEllipse(){
      return cy.get('.primary-workspace .drawing-tool-button.button-ellipse');
    }
    getDrawToolStamp(){
      return cy.get('.primary-workspace .drawing-tool-button.button-stamp');
    }
    getDrawToolStampExpand(){
      return cy.get('.primary-workspace .drawing-tool-button.button-stamp .expand-collapse');
    }
    getDrawToolText(){
      return cy.get('.primary-workspace .drawing-tool-button.button-text');
    }
    getDrawToolStrokeColor(){
      return cy.get('.primary-workspace .drawing-tool-button.button-stroke-color');
    }
    getDrawToolFillColor(){
      return cy.get('.primary-workspace .drawing-tool-button.button-fill-color');
    }
    getDrawToolVariable(){
      return cy.get('.primary-workspace .drawing-tool-button.button-variable');
    }
    getDrawToolNewVariable(){
      return cy.get('.primary-workspace .drawing-tool-button.button-new-variable');
    }
    getDrawToolInsertVariable(){
      return cy.get('.primary-workspace .drawing-tool-button.button-insert-variable');
    }
    getDrawToolEditVariable(){
      return cy.get('.primary-workspace .drawing-tool-button.button-edit-variable');
    }
    getDrawToolUploadImage(){
      return cy.get('.primary-workspace .drawing-tool-button.image-upload input');
    }
    getDrawToolDelete(){
      return cy.get('.primary-workspace .drawing-tool-button.button-delete');
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
    getVariableChip() {
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer .drawing-variable.variable-chip');
    }
    getDrawTileTitle(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .drawing-tool-tile .editable-tile-title`);
  }
}

export default DrawToolTile;
