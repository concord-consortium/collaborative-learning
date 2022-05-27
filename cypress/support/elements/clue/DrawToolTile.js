class DrawToolTile{
    getDrawTile(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .drawing-tool-tile`);
    }
    getDrawToolSelect(){
      return cy.get('.primary-workspace .drawing-tool-button.button-select');
    }
    getDrawToolFreehand(){
      return cy.get('.primary-workspace .drawing-tool-button.button-line');
    }
    getDrawToolLine(){
      return cy.get('.primary-workspace .drawing-tool-button.button-vector');
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
      return cy.get('.primary-workspace .drawing-tool-button.button-stamp expand-collapse');
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
    getDrawToolDelete(){
      return cy.get('.primary-workspace .drawing-tool-button.button-delete');
    }
    getFreehandDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg path');
    }
    getVectorDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg line');
    }
    getRectangleDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg rect');
    }
    getEllipseDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg ellipse');
    }
    getImageDrawing(){
      return cy.get('.primary-workspace [data-testid=drawing-tool] .drawing-layer svg image');
    }
}

export default DrawToolTile;
