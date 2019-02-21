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
    describe.only('connect table to graph before adding coordinates', function(){
        it('setup', function(){
            leftNav.openToWorkspace('Extra Workspace');
            addTableAndGraph();
            connectTableToGraph();
        });
        describe('Test blank cells',function(){
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
                tableToolTile.getTableCell().eq(2).type('9{enter}');
                graphToolTile.getGraphPointLabel().contains('p2').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '('+xCoord+', 0)' )
            });
            it('will add a coordinate in y only column', function(){
                let yCoord = '9';
                tableToolTile.addNewRow();
                tableToolTile.getTableIndexColumnCell().eq(2).should('contain', 'p3');
                tableToolTile.getTableCell().eq(5).type(yCoord+'{enter}');
                graphToolTile.getGraphPointLabel().contains('p3').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '(0, '+yCoord+' )');
            });
        });
        describe('test creating a polygon', function (){
            it('will add both coordinates in the table', function(){
                tableToolTile.getTableCell().eq(6).type('5');
                tableToolTile.getTableCell().last().type('5{enter}');
                graphToolTile.getGraphPointLabel().contains('p1').should('exist');
                graphToolTile.getGraphPointCoordinates().should('contain', '(5, 5)' );
            });
            it('will create a polygon', function(){ //first point is created in previous it
                graphToolTile.getGraphPoint().last().click({force:true}).click({force:true});
                graphToolTile.getGraphPolygon().should('exist')
            });
        });
        describe('text axes changes', function(){
            it('will change the name of the axis in the table', function(){

            });
        });
        describe('normal graph interactions', function(){
            it('will add a polygon directly onto the graph', function(){

            });
            it('will add and angle to a point created from a table', function(){

            });

            it('will delete a point in the table', function(){

            });
            it('will add an image to a graph that is connected to a table', function(){

            });
        });
        describe('Test disconnecting the table', function(){
            it('will delete the connected table', function(){

            });
        });
    });
    describe('connect table to graph after adding coordinates in table', function(){
        describe('Test blank cells',function(){
            it('setup', function(){
                leftNav.openToWorkspace('What if...?');
                addTableAndGraph();
            })
        });
        it('will add a point at the origin', function(){

        });
        it('will add coordinates in the table', function(){
            tableToolTile.getTableCell().first().type('5');
            tableToolTile.getTableCell().last().type('5{enter}');
            graphToolTile.getGraphPointLabel().contains('p1').should('exist');
            graphToolTile.getGraphPointCoordinates().should('contain','(5, 5)');
        });
        it('will change the name of the axis in the table', function(){

        });
        it('will connect table to graph', function(){
            connectTableToGraph();
        });
        it('will add an angle to a point created from a table', function(){

        });

        it('will delete a point in the table', function(){

        });
    });
});

context('Test normal graph functions in a connected graph', function(){
    it('setup 2 - connect table to graph', function(){
        leftNav.openToWorkspace('Now What');
        canvas.addTableTile();
        canvas.addGraphTile();
    });
    it('will connect table to graph', function(){
        const dataTransfer = new DataTransfer;

        tableToolTile.getTableTile()
            .trigger('dragstart', {dataTransfer});
        graphToolTile.getGraphTile()
            .trigger('drop', {dataTransfer});
        tableToolTile.getTableTile()
            .trigger('dragend');
        tableToolTile.getTableCell().first().type('5');
        tableToolTile.getTableCell().last().type('5{enter}');
        graphToolTile.getGraphPointLabel().contains('p1').should('exist');
        // graphToolTile.getGraphPointCoordinates().should('contain','(5,5)');
    });
    it('will add a polygon', function(){

    });
    it('will delete a point', function(){

    });
    it('will add an image to a graph that is connected to a table', function(){

    });
});

context('Learning log', function(){
    it('will create a learning log', function(){

    });
    it('will connect table to graph', function(){
        const dataTransfer = new DataTransfer;

        tableToolTile.getTableTile()
            .trigger('dragstart', {dataTransfer});
        graphToolTile.getGraphTile()
            .trigger('drop', {dataTransfer});
        tableToolTile.getTableTile()
            .trigger('dragend');
        tableToolTile.getTableCell().first().type('5');
        tableToolTile.getTableCell().last().type('5{enter}');
        graphToolTile.getGraphPointLabel().contains('p1').should('exist');
        // graphToolTile.getGraphPointCoordinates().should('contain','(5,5)');
        //verify that table has p1 in the row
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
        leftNav.openToWorkspace('Extra Workspace');
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