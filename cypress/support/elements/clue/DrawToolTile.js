class DrawToolTile{
    getDrawTile(){
        return cy.get('.canvas-area .drawing-tool');
    }
    getDrawToolMenu(){
        return cy.get('.drawing-tool-button[title="Settings"');
    }
    getDrawToolSelect(){
        return cy.get('drawing-tool-button[title="Select"');
    }
    getDrawToolFreehand(){
        return cy.get('drawing-tool-button[title="Freehand Tool"');
    }
    getDrawToolLine(){
        return cy.get('drawing-tool-button[title="Line Tool"');
    }
    getDrawToolRectangle(){
        return cy.get('drawing-tool-button[title="Rectangle Tool"');
    }
    getDrawToolEllipse(){
        return cy.get('drawing-tool-button[title="Ellipse Tool"');
    }
    getDrawToolDelete(){
        return cy.get('drawing-tool-button[title="Delete"');
    }
}

export default DrawToolTile;
