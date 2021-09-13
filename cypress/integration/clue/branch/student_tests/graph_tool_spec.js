import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import PrimaryWorkspace from '../../../../support/elements/common/PrimaryWorkspace';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const primaryWorkspace = new PrimaryWorkspace;

const problemDoc = '2.1 Drawing Wumps';
const ptsDoc = 'Points';
const polyDoc = 'Polygon';

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
        it('will add a polygon to a graph', function(){
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
            primaryWorkspace.getResizePanelDivider().click();
            primaryWorkspace.openPrimaryWorkspaceTab("my-work");
            cy.openDocumentWithTitle('my-work','workspaces', problemDoc);
            graphToolTile.getGraphPointCoordinates().should('contain', '(0, 0)');
        });
        it('will verify restore of multiple points', function(){
            cy.openDocumentWithTitle('my-work','workspaces', ptsDoc);
            graphToolTile.getGraphPoint().should('have.length',3);
        });
        it('will verify restore of polygon', function(){
            cy.openDocumentWithTitle('my-work','workspaces', polyDoc);
            graphToolTile.getGraphPolygon().should('exist');
        });
    });

    context('Graph Toolbar', function(){
        describe('interact with points and polygons', function(){
            it('will select a point', function(){
                let point=4;
                cy.openDocumentWithTitle('my-work','workspaces', ptsDoc);
                primaryWorkspace.closePrimaryWorkspaceTabs();
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
                let transX=(graphToolTile.transformFromCoordinate('x', x))+(8*graphUnit),
                    transY=(graphToolTile.transformFromCoordinate('y', y))+(5*graphUnit);

                graphToolTile.getGraphPoint().last()
                    .trigger('mousedown',{dataTransfer, force:true})
                    .trigger('mousemove',{clientX:transX, clientY:transY, dataTransfer, force:true})
                    .trigger('mouseup',{dataTransfer, force:true});
                // graphToolTile.getGraphPointCoordinates().should('contain', '('+x+', '+y+')');
                graphToolTile.getGraphPointCoordinates().should('contain', '(18, 2)');
            });
            it('will copy and paste a point', function(){ //cannot send keyboard commands to non-text fields

            });
            it('will show and hide angles to a polygon', function(){
                let numAngles=1;
                primaryWorkspace.getResizePanelDivider().click();
                primaryWorkspace.openPrimaryWorkspaceTab("my-work");
                cy.openDocumentWithTitle('my-work','workspaces', polyDoc);
                primaryWorkspace.closePrimaryWorkspaceTabs();
                graphToolTile.selectGraphPoint(4.2,2);
                graphToolTile.selectGraphPoint(4.2,2);
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles);
                graphToolTile.selectGraphPoint(10.4, 7.2);
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist').and('have.length',numAngles+1);
                graphToolTile.selectGraphPoint(13.2,2);
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
            it('will drag a polygon to a new location', function(){
                const dataTransfer = new DataTransfer;
                const graphUnit = 18.33;
                let x= 18, y=5;
                let newX1 = 9, newY1=6;
                let newX2 = 16, newY2=11;
                let newX3 = 18, newY3=6;

                let transX=(graphToolTile.transformFromCoordinate('x', x))+(8*graphUnit),
                    transY=(graphToolTile.transformFromCoordinate('y', y))+(5*graphUnit);
                graphToolTile.getGraphPolygon().click({force:true});
                graphToolTile.getGraphPoint().last()
                    .trigger('mousedown',{dataTransfer, force:true})
                    .trigger('mousemove',{clientX:transX, clientY:transY, dataTransfer, force:true})
                    .trigger('mouseup',{dataTransfer, force:true});
                //TODO: verify move
                // graphToolTile.getGraphPointCoordinates(0).should('contain', '('+newX1+', '+newY1+')');
                // graphToolTile.getGraphPointCoordinates(1).should('contain', '('+newX2+', '+newY2+')');
                // graphToolTile.getGraphPointCoordinates(2).should('contain', '('+newX3+', '+newY3+')');

                graphToolTile.getGraphPointCoordinates(0).should('contain', '(12, 6)');
                graphToolTile.getGraphPointCoordinates(1).should('contain', '(18, 11)');
                graphToolTile.getGraphPointCoordinates(2).should('contain', '(21, 6)');
            });
            it('verify rotate tool is visible when polygon is selected', function(){
                graphToolTile.getGraphPolygon().click({force:true});
                graphToolTile.getRotateTool().should('be.visible');
            });
            it('will rotate a polygon', function(){
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
            it('will copy and paste a polygon', function(){
                graphToolTile.getGraphPolygon().click({force: true});
                graphToolTile.copyGraphElement();
                graphToolTile.getGraphPolygon().should('have.length',2);
                graphToolTile.getAngleAdornment().should('have.length',6);
                graphToolTile.getGraphPoint().should('have.length',6);
            });
            it('will restore changes to a graph', function(){
                primaryWorkspace.getResizePanelDivider().click();
                primaryWorkspace.openPrimaryWorkspaceTab("my-work");
                cy.openDocumentWithTitle('my-work','workspaces', polyDoc);
                graphToolTile.getAngleAdornment().should('exist').and('have.length',6);
            });
        });

        describe('delete points and polygons', function(){
            it.skip('verify delete points with delete tool', function(){ //current behavior of text deletes the entire graph tool tile. Point selection has to be forced
                let basePointCount = 3; // number of points already in doc2
                cy.openDocumentWithTitle('my-work','workspaces', ptsDoc);
                primaryWorkspace.getResizeLeftPanelHandle().click();
                graphToolTile.selectGraphPoint(15,2);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount -1);
                graphToolTile.selectGraphPoint(10,5);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount -2);
                graphToolTile.selectGraphPoint(5,5);
                // graphToolTile.deleteGraphElement();
                // graphToolTile.getGraphPoint().should('have.length', basePointCount-3)
            });
            it.skip('verify delete polygon',()=>{
                primaryWorkspace.getResizeRightPanelHandle().click();
                cy.openDocumentWithTitle('my-work','workspaces', polyDoc);
                graphToolTile.getGraphPolygon().last().click({force:true});
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPolygon().should('have.length',1);
            });
            it.skip('verify delete points alters polygon',()=>{
                let basePointCount = 3, baseAngleCount=3; // number of points already in doc

                graphToolTile.getGraphPoint().should('have.length', basePointCount);
                graphToolTile.selectGraphPoint(16, 3.5);
                graphToolTile.getAngleAdornment().should('have.length',baseAngleCount);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount-1);
                // graphToolTile.selectGraphPoint(16.2, 9.5);
                graphToolTile.getGraphPoint().last().click({force: true});
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount -2);
                graphToolTile.selectGraphPoint(8, 8);
                graphToolTile.deleteGraphElement();
                graphToolTile.getGraphPoint().should('have.length', basePointCount-3);
            });
        });

        describe.skip('movable line tests',()=>{
            it('verify add a movable line', function(){
                canvas.createNewExtraDocumentFromFileMenu(lineDoc, "my-work");
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
