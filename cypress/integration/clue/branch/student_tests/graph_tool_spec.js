import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import RightNav from '../../../../support/elements/common/RightNav';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const rightNav = new RightNav;

const problemDoc = '2.1 Drawing Wumps';
const ptsDoc = 'Points';
const polyDoc = 'Polygon';
const lineDoc = 'Movable Line';

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.waitForSpinner();
});
context('Test graph tool functionalities', function(){
    describe('adding points and polygons to a graph', function(){
        it('will add a point to the origin', function(){
            // clueCanvas.addTileByDrag('geometry','left');
            clueCanvas.addTile('geometry');
            graphToolTile.addPointToGraph(0,0);
            graphToolTile.getGraphPointCoordinates().should('contain', '(0, 0)');
        });
        it('will add points to a graph', function(){
            canvas.createNewExtraDocumentFromFileMenu(ptsDoc, "my-work");
            clueCanvas.addTile('geometry');
            cy.get('.spacer').click();
            clueCanvas.deleteTile('text');
            graphToolTile.getGraphTile().last().click();
            graphToolTile.addPointToGraph(5,5);
            graphToolTile.addPointToGraph(10,5);
            graphToolTile.addPointToGraph(10,10);
        });
        it.skip('will add a polygon to a graph', function(){
            canvas.createNewExtraDocumentFromFileMenu(polyDoc, "my-work");
            clueCanvas.addTile('geometry');
            cy.get('.spacer').click();
            clueCanvas.deleteTile('text');
            graphToolTile.getGraphTile().last().click();
            graphToolTile.addPointToGraph(4.2,2);
            graphToolTile.addPointToGraph(10.4, 7.2);
            graphToolTile.addPointToGraph(13.2,2);
            graphToolTile.addPointToGraph(13.2,2);
            graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
            graphToolTile.getGraphPolygon().should('exist');
        });
    });

    describe('restore points to canvas', function(){
        it('will verify restore of point at origin', function(){
            rightNav.openDocumentWithTitle('my-work','workspace', problemDoc);
            graphToolTile.getGraphPointCoordinates().should('contain', '(0, 0)');
        });
        it('will verify restore of multiple points', function(){
            rightNav.openDocumentWithTitle('my-work','workspace', ptsDoc);
            graphToolTile.getGraphPoint().should('have.length',3);
        });
        it.skip('will verify restore of polygon', function(){
            rightNav.openDocumentWithTitle('my-work','workspace', polyDoc);
            graphToolTile.getGraphPolygon().should('exist');
        });
    });

    context('Graph Toolbar', function(){
        describe.skip('interact with points and polygons', function(){
            it('will select a point', function(){
                let point=4;
                canvas.openDocumentWithTitle('personal-documents', ptsDoc);
                graphToolTile.getGraphTile().click({multiple: true});
                graphToolTile.selectGraphPoint(10,10);
                graphToolTile.getGraphPointID(point)
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            // expect($el).to.have.text('(13.20, 5)');
                            expect($el).to.have.text('');
                        });
                    });
                // graphToolTile.getGraphPointCoordinates().should('contain', '(13.20, 5)');
                graphToolTile.getGraphPointCoordinates().should('contain', '(10, 10)');
            });
            it('will drag a point to a new location', function(){
                const dataTransfer = new DataTransfer;
                const graphUnit = 18.33;
                let x= 15, y=2;
                let transX=(graphToolTile.transformFromCoordinate('x', x))+(12*graphUnit),
                    transY=(graphToolTile.transformFromCoordinate('y', y))+(6.5*graphUnit);

                graphToolTile.getGraphPoint().last()
                    .trigger('mousedown',{dataTransfer, force:true})
                    .trigger('mousemove',{clientX:transX, clientY:transY, dataTransfer, force:true})
                    .trigger('mouseup',{dataTransfer, force:true});
                graphToolTile.getGraphPointCoordinates().should('contain', '('+x+', '+y+')');
            });
            // it('will copy and paste a point', function(){ //cannot send keyboard commands to non-text fields
            //
            // });
            it.skip('will show and hide angles to a polygon', function(){
                let numAngles=1;
                canvas.openDocumentWithTitle('personal-documents', polyDoc);
                graphToolTile.selectGraphPoint(4.2,2);
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles);
                graphToolTile.selectGraphPoint(10.4, 7.2);
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles+1);
                graphToolTile.selectGraphPoint(4.2,2);
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles+2);
                graphToolTile.selectGraphPoint(13.2,2);
                graphToolTile.hideAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles+1);
                graphToolTile.selectGraphPoint(10.4, 7.2);
                graphToolTile.hideAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles);
                graphToolTile.selectGraphPoint(4.2,2);
                graphToolTile.hideAngle();
                graphToolTile.getAngleAdornment().should('not.exist');

                //Add the angles angle for the restore test later
                graphToolTile.selectGraphPoint(13.2,2);
                graphToolTile.showAngle();
                graphToolTile.selectGraphPoint(10.4, 7.2);
                graphToolTile.showAngle();
                graphToolTile.selectGraphPoint(4.2,2);
                graphToolTile.showAngle();
                graphToolTile.selectGraphPoint(4.2,2);

            });
            it.skip('will drag a polygon to a new location', function(){
                const dataTransfer = new DataTransfer;
                const graphUnit = 18.33;
                let x= 18, y=5;
                let newX1 = 9, newY1=5;
                let newX2 = 16, newY2=10;
                let newX3 = 18, newY3=5;

                let transX=(graphToolTile.transformFromCoordinate('x', x))+(12*graphUnit),
                    transY=(graphToolTile.transformFromCoordinate('y', y))+(6.5*graphUnit);
                graphToolTile.getGraphPolygon().click({force:true});
                graphToolTile.getGraphPoint().last()
                    .trigger('mousedown',{dataTransfer, force:true})
                    .trigger('mousemove',{clientX:transX, clientY:transY, dataTransfer, force:true})
                    .trigger('mouseup',{dataTransfer, force:true});
                //TODO: verify move
                graphToolTile.getGraphPointCoordinates(0).should('contain', '('+newX1+', '+newY1+')');
                graphToolTile.getGraphPointCoordinates(1).should('contain', '('+newX2+', '+newY2+')');
                graphToolTile.getGraphPointCoordinates(2).should('contain', '('+newX3+', '+newY3+')');
            });
            it.skip('verify rotate tool is visible when polygon is selected', function(){
                canvas.openDocumentWithTitle('personal-documents', polyDoc);
                graphToolTile.getGraphPolygon().click({force:true});
                graphToolTile.getRotateTool().should('be.visible');
            });
            it.skip('will rotate a polygon', function(){
                //not sure how to verify the rotation
                graphToolTile.getRotateTool()
                    .trigger('mousedown')
                    .trigger('dragstart')
                    .trigger('mousemove',18, 73, {force:true})
                    .trigger('dragend')
                    .trigger('drop')
                    .trigger('mouseup');
                //TODO verify points are in new location
            });
            it.skip('will copy and paste a polygon', function(){
                graphToolTile.getGraphPolygon();
                graphToolTile.copyGraphElement();
                graphToolTile.getGraphPolygon().should('have.length',2);
                graphToolTile.getAngleAdornment().should('have.length',6);
                graphToolTile.getGraphPoint().should('have.length',6);
            });
            it.skip('will restore changes to a graph', function(){
                canvas.openDocumentWithTitle('personal-documents', polyDoc);
                graphToolTile.getAngleAdornment().should('exist').and('have.length',6);
            });
        });

        describe.skip('delete points and polygons', function(){
            it('verify delete points with delete tool', function(){ //current behavior of text deletes the entire graph tool tile. Point selection has to be forced
                let basePointCount = 3; // number of points already in doc2

                canvas.openDocumentWithTitle('personal-documents', ptsDoc);
                graphToolTile.selectGraphPoint(10,10);
                clueCanvas.getDeleteTool().click();
                graphToolTile.getGraphPoint().should('have.length', basePointCount -1);
                graphToolTile.selectGraphPoint(10,5);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount -2);
                graphToolTile.selectGraphPoint(5,5);
                // graphToolTile.deleteGraphElement();
                // graphToolTile.getGraphPoint().should('have.length', basePointCount-3)
            });
            it('verify delete polygon',()=>{
                canvas.openDocumentWithTitle('personal-documents', polyDoc);

                graphToolTile.getGraphPolygon().last().click({force:true});
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPolygon().should('have.length',1);
            });
            it('verify delete points alters polygon',()=>{
                let basePointCount = 3, baseAngleCount=3; // number of points already in doc

                graphToolTile.getGraphPoint().should('have.length', basePointCount);
                graphToolTile.selectGraphPoint(18.5,5.1);
                graphToolTile.getAngleAdornment().should('have.length',baseAngleCount);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount-1);
                graphToolTile.selectGraphPoint(15.4, 10.2);
                // graphToolTile.getGraphPoint().last().click();
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount -2);
                graphToolTile.selectGraphPoint(9.2,5);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount-3);
            });
        });

        describe('movable line tests',()=>{
            it('verify add a movable line', function(){
                canvas.createNewExtraDocument(lineDoc);
                clueCanvas.addTile('geometry');
                graphToolTile.addMovableLine();

            });
            // it.skip('verify move the movable line', function () {

            // });
            // it.skip('verify rotate the movable line', function () {

            // });
            // it.skip('verify movable line equation edit', function () {

            // });
        });
    });
});

after(function(){
  cy.clearQAData('all');
});
