class DrawToolTile{
    getDrawTile(workspaceClass){
      return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .drawing-tool-tile`);
    }
    getDrawToolSelect(){
      return cy.get('.drawing-tool-button.button-select');
    }
    getDrawToolFreehand(){
      return cy.get('.drawing-tool-button.button-line');
    }
    getDrawToolLine(){
      return cy.get('.drawing-tool-button.button-vector');
    }
    getDrawToolRectangle(){
      return cy.get('.drawing-tool-button.button-rectangle');
    }
    getDrawToolEllipse(){
      return cy.get('.drawing-tool-button.button-ellipse');
    }
    getDrawToolVariable(){
      return cy.get('.drawing-tool-button.button-variable');
    }
    getDrawToolDelete(){
      return cy.get('.drawing-tool-button.button-delete');
    }
    getFreehandDrawing(){
      return cy.get('[data-testid=drawing-tool] .drawing-layer svg path');
    }
    getVectorDrawing(){
      return cy.get('[data-testid=drawing-tool] .drawing-layer svg line');
    }
    getRectangleDrawing(){
      return cy.get('[data-testid=drawing-tool] .drawing-layer svg rect');
    }
    getEllipseDrawing(){
      return cy.get('[data-testid=drawing-tool] .drawing-layer svg ellipse');
    }
}

export default DrawToolTile;
