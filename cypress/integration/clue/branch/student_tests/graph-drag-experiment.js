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
    clueCanvas.addTileByDrag('geometry','left');
});
context('Test graph tool functionalities', function(){
    it('drag a point',()=>{
        const dataTransfer = new DataTransfer;
        const graphUnit = 17.8;
        let x= 15, y=0;
        let transX=(graphToolTile.transformFromCoordinate('x', x))+(12*graphUnit),
            transY=(graphToolTile.transformFromCoordinate('y', y))+(8.5*graphUnit);

        graphToolTile.addPointToGraph(0,0)
        graphToolTile.addPointToGraph(5,5)
        graphToolTile.addPointToGraph(10,0)
        graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
        graphToolTile.getGraphPolygon().should('exist')
        graphToolTile.getGraphPoint().last()
            .trigger('mousedown',{dataTransfer, force:true})
            .trigger('mousemove',{clientX:transX, clientY:transY, dataTransfer, force:true})
            .trigger('mouseup',{dataTransfer, force:true});
        graphToolTile.getGraphPointCoordinates(2).should('contain', '('+x+', '+y+')');    
    })
    it('drag a polygon',()=>{
        const dataTransfer = new DataTransfer;
        const graphUnit = 17.8;
        let x= 15, y=10;
        let transX=(graphToolTile.transformFromCoordinate('x', x))+(12*graphUnit),
            transY=(graphToolTile.transformFromCoordinate('y', y))+(8.5*graphUnit);
        // graphToolTile.addPointToGraph(0,0)
        // graphToolTile.addPointToGraph(5,5)
        // graphToolTile.addPointToGraph(10,0)
        // graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
        // graphToolTile.getGraphPolygon().should('exist')
        graphToolTile.getGraphPolygon().click({force:true})
        graphToolTile.getGraphPolygon()
            .trigger('mousedown',{dataTransfer, force:true})
            // .trigger('dragstart',{force:true})
            .trigger('mousemove',{offsetX:50, offsetY:50, dataTransfer, force:true})
            // .trigger('dragend',{force:true})
            // .trigger('drop',{force:true})
            // .trigger('mouseup',{dataTransfer, force:true})
    })
})