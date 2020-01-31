import LeftNav from '../../../../support/elements/clue/LeftNav'
import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile'
import RightNav from '../../../..//support/elements/common/RightNav'
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile'
import TextToolTile from '../../../../support/elements/clue/TextToolTile'
import TableToolTile from '../../../../support/elements/clue/TableToolTile'

const leftNav = new LeftNav;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const rightNav = new RightNav;
const graphToolTile = new GraphToolTile;
const textToolTile = new TextToolTile;
const tableToolTile = new TableToolTile;

let doc1='2.1 Drawing Wumps', doc2='Points', doc3='Polygon', doc4='Movable Line'

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner();
});
context('Test graph tool functionalities', function(){
    it('delete text tool',()=>{
        clueCanvas.addTile('table');
        clueCanvas.addTile('geometry');
        tableToolTile.getTableTile().click();
        tableToolTile.getTableTile().parent().should('have.class', 'selected')
        graphToolTile.getGraphTile().click();
        graphToolTile.getGraphTile().parent().should('have.class', 'selected')  
        textToolTile.getTextTile()
            .trigger('mousedown')
            // .type("I'm in the text tool")
            // .trigger('mousedown')
        textToolTile.getTextTile().parent().should('have.class', 'selected')    
    })
})