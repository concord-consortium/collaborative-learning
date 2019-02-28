import LeftNav from '../support/elements/LeftNav'
import Canvas from '../support/elements/Canvas'
import GraphToolTile from '../support/elements/GraphToolTile'
import RightNav from '../support/elements/RightNav'
import BottomNav from '../support/elements/BottomNav';
import LearningLog from '../support/elements/LearningLog';
import TableToolTile from '../support/elements/TableToolTile'
import ImageToolTile from '../support/elements/ImageToolTile'

const leftNav = new LeftNav;
const canvas = new Canvas;
const rightNav = new RightNav;
const learningLog = new LearningLog;
const graphToolTile = new GraphToolTile;
const tableToolTile = new TableToolTile;
const imageToolTile = new ImageToolTile;

function addTableAndGraph(){
    canvas.addTableTile();
    canvas.addGraphTile();
}

function deleteTableAndGraph(){
    canvas.deleteTile('graph');
    canvas.deleteTile('table');
}

function connectTableToGraph(){
    const dataTransfer = new DataTransfer;

    tableToolTile.getTableTile()
        .trigger('dragstart', {dataTransfer});
    graphToolTile.getGraphTile()
        .trigger('drop', {dataTransfer});
    tableToolTile.getTableTile()
        .trigger('dragend');
}

context('Tests for graph and table integration', function(){
    describe('connect table to graph before adding coordinates', function(){
        it('setup', function(){
            leftNav.openToWorkspace('Extra Workspace');
            addTableAndGraph();
            connectTableToGraph();
        });
        describe('Test blank cells',function(){//verify this is still true
            it('will add a blank row', function(){ 
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().first().should('contain', 'p1');
                graphToolTile.getGraphPointLabel().contains('p1').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '(0, 0)' )
            });
            it('will add a coordinate in x only column', function(){
                let xCoord = '9';
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().eq(1).should('contain', 'p2');
                tableToolTile.getTableCell().eq(2).type(xCoord);
                tableToolTile.getTableCell().eq(3).type(' ');
                graphToolTile.getGraphPointLabel().contains('p2').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '('+xCoord+', 0)' )
            });
            it('will add a coordinate in y only column', function(){
                let yCoord = '9';
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
                tableToolTile.getTableCell().eq(5).type(yCoord);
                tableToolTile.getTableCell().eq(4).type('0');
                graphToolTile.getGraphPointLabel().contains('p3').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '(0, '+yCoord+')');
            });
        });
        describe('test creating a polygon', function (){
            it('will add both coordinates in the table', function(){
                tableToolTile.getTableCell().eq(6).type('5');
                tableToolTile.getTableCell().eq(7).type('0');
                tableToolTile.getTableCell().eq(8).type(' ');//need to create the next row
                tableToolTile.getTableCell().eq(7).type('5');//go back and update p4 to be the right coords.
                tableToolTile.getTableCell().eq(8).type(' ');//type in blank again so the coordinate sticks

                //verify p4 is on the table
                graphToolTile.getGraphPointLabel().contains('p4').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '(5, 5)' );
            });
            it('will create a polygon', function(){ //first point is created in previous it
                graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
                graphToolTile.getGraphPolygon().should('exist')
            });
            it('will add angle to a table point', function(){
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist');
            });
            it('will move a point by changing coordinates on the table', function(){
                let new_x = '8';
                tableToolTile.getTableCell().eq(6).type(new_x);
                tableToolTile.getTableCell().eq(8).type(' ');//type in blank again so the coordinate sticks
                graphToolTile.getGraphPointCoordinates().should('contain', '('+new_x+', 5)' )
            })
            it('will delete a point in the table', function(){
                let  id='';
                let point=2; //the 3rd point in the graph
                tableToolTile.removeRows(2);
               //verifies p3 no longer exist in table and graph
                tableToolTile.getTableRow().should('have.length',4)
                tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
                tableToolTile.getTableIndexColumnCell().eq(3).should('not.contain', 'p4');
                graphToolTile.getGraphPointLabel().contains('p4').should('not.exist');
                graphToolTile.getGraphPointID(point)
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            expect($el).to.not.be.visible;                        
                    })
                });
                //verifies angle adornment no longer exists
                graphToolTile.getAngleAdornment().should('not.exist')
            });
        });
        describe('text axes changes', function(){
            it('will change the name of the x-axis in the table', function(){
                let id='';
                tableToolTile.renameColumn('x', 'mars');
                graphToolTile.getGraphAxisLabelId('x')
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            expect($el.text()).to.contain('mars');                        
                        })
                    });
            });
            it('will change the name of the y-axis in the table', function(){
                let id='';
                tableToolTile.renameColumn('y', 'venus');
                graphToolTile.getGraphAxisLabelId('y')
                    .then((id)=> {
                        id = '#'.concat(id);
                        cy.get(id).then(($el) => {
                            expect($el.text()).to.contain('venus');
                        });
                    });
            });
        });
        describe('normal graph interactions', function(){
            it('will add a polygon directly onto the graph', function(){
                graphToolTile.getGraphTile().click();
                graphToolTile.addPointToGraph(10,15);
                graphToolTile.addPointToGraph(13,10);
                graphToolTile.addPointToGraph(5,10)
                graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
            });
            it('will add and angle to a point created from a table', function(){
                graphToolTile.showAngle();
                graphToolTile.getAngleAdornment().should('exist');
            });
            it('will add an image to a graph that is connected to a table', function(){
                const imageFilePath='image.png';
                const dataTransfer = new DataTransfer;

                canvas.addImageTile();
                imageToolTile.getImageTile().scrollIntoView().click();
                imageToolTile.getImageToolControl().click();
                cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/png')
                cy.wait(2000)
                imageToolTile.getImageTile()
                    .trigger('dragstart', {dataTransfer});
                graphToolTile.getGraphTile()
                    .trigger('drop', {dataTransfer});
                    imageToolTile.getImageTile()
                    .trigger('dragend');
                cy.get('.canvas-area .geometry-content svg g image').should('exist');    
            });
        });
        describe('test non-numeric entries in table', function(){
            it('will enter non-numeric number in the table', function(){
                tableToolTile.getTableCell().eq(6).type('g{enter}');
                tableToolTile.getTableCell().eq(6).should('be.empty')
            })
        });
        describe('Test disconnecting the table', function(){
            it('will delete the connected table', function(){
                canvas.deleteTile('table');
                //verify axis rename does not exist
                graphToolTile.getGraphAxisLabelId('x')
                    .then((id)=>{
                        id='#'.concat(id);
                        cy.get(id).then(($el)=>{
                            expect($el.text()).to.not.contain('mars');                        
                        })
                    });
                graphToolTile.getGraphPointLabel().contains('p1').should('not.exist'); 
                graphToolTile.getGraphPointLabel().contains('A').should('exist');    
            });
        });
    });
    describe('connect table to graph after adding coordinates in table', function(){
        it('setup', function(){
            leftNav.openToWorkspace('What if...?');
            canvas.getCanvasTitle().should('contain', 'What if...?')
            addTableAndGraph();
        })
        it('will add coordinates in the table', function(){
            tableToolTile.getTableCell().eq(0).type('5');
            tableToolTile.getTableCell().eq(1).type('5');
            tableToolTile.getTableCell().eq(2).type('0');
            tableToolTile.getTableCell().eq(3).type('0');
            tableToolTile.getTableCell().eq(4).type('9');
            tableToolTile.getTableCell().eq(5).type('5');
            tableToolTile.getTableCell().eq(6).type(' '); //type in space in the ghost row in lieu of {enter}
            tableToolTile.getTableCell().eq(1).type('5');
            tableToolTile.getTableCell().eq(6).type(' ');
            tableToolTile.getTableCell().eq(3).type('0');
            tableToolTile.getTableCell().eq(6).type(' ');
            tableToolTile.getTableCell().eq(5).type('5');
            tableToolTile.getTableCell().eq(6).type(' ');

        });
        it('will change the name of the axis in the table', function(){
            tableToolTile.renameColumn('x', 'neptune');
            tableToolTile.renameColumn('y', 'saturn');
        });
        it('will connect table to graph', function(){
            connectTableToGraph();
        });
        it('verify table is labeled with point names', function(){
            tableToolTile.getTableIndexColumnCell().eq(0).should('contain', 'p1');
            tableToolTile.getTableIndexColumnCell().eq(1).should('contain', 'p2');
            tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
        })
        it('verify points are on the graph', function(){
            graphToolTile.getGraphPointLabel().contains('p1').should('exist');
            // graphToolTile.getGraphPointCoordinates().should('contain', '(5, 5)' );
            graphToolTile.getGraphPointLabel().contains('p2').should('exist');
            // graphToolTile.getGraphPointCoordinates().should('contain', '(0, 0)' );
            graphToolTile.getGraphPointLabel().contains('p3').should('exist');
            // graphToolTile.getGraphPointCoordinates().should('contain', '(9, 5)' )
        });
        it('verify axes names are on the graph', function(){
            graphToolTile.getGraphAxisLabelId('x')
            .then((id)=>{
                id='#'.concat(id);
                cy.get(id).then(($el)=>{
                    expect($el.text()).to.contain('neptune');                        
                })
            });
            graphToolTile.getGraphAxisLabelId('y')
            .then((id)=> {
                id = '#'.concat(id);
                cy.get(id).then(($el) => {
                    expect($el.text()).to.contain('saturn');
                });
            });
        });
    });
});

context('Learning log', function(){
    it('will create a learning log', function(){

    });
    it('will connect table to graph', function(){
        // connectTableToGraph();
    });
    it('will create a polygon in the table', function(){ //first point is created in previous it

    });
    it('will publish learning log', function(){

    });
    it('will open Class Work canvas in 2up view', function(){

    });
    it('will close learning log, and restore', function(){

    });
});

context('Save and restore keeps the connection between table and graph', function(){
    it('will restore a canvas with connected table and graph', function(){
        // leftNav.openToWorkspace('Extra Workspace');
    });
    it('will add a point to the graph from the table', function(){
        //verify that point is added to the graph
    });
});

context('Delete connected table', function(){
    it('will delete connected table', function(){

    });
    it('will verify graph is still functional after connected table is deleted', function(){

    });
});