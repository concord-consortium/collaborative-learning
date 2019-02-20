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
                //verify there is a point at 0,0 labeled p1
            });
            it('will add a coordinate in x only column', function(){
                let xCoord = 10;
                tableToolTile.addNewRow();
                //Add a xCoord in the x column
                //verify that p2 appears in (xCoord,0)
            });
            it('will add a coordinate in y only column', function(){
                let yCoord = 10;
                tableToolTile.addNewRow();
                //Add a yCoord in the y column
                //verify that p2 appears in (0,yCoord)
            });
        });
        it('will add coordinates in the table', function(){
            tableToolTile.getTableCell().first().type('5');
            tableToolTile.getTableCell().last().type('5{enter}');
            graphToolTile.getGraphPointLabel().contains('p1').should('exist');
            graphToolTile.getGraphPointCoordinates().should('contain', '(5, 10)' );
        });
        it('will add a point at the origin', function(){

        });
        it('will create a polygon in the table', function(){ //first point is created in previous it

    });
    it('will copy a point', function(){

    });
    it('will copy a polygon', function(){

    });
    it('will change the name of the axis in the table', function(){

    });
    it('will add an angle to a point created from a table', function(){

    });
    it('will add a row in the table, and add a point to the graph', function(){

    });
    it('will delete a point in the graph that was added from the table', function(){
        //verify that it is not possible - graph delete icon should be disabled
    });
    it('will delete a point in the table', function(){

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
        // graphToolTile.getGraphPoint
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
        // graphToolTile.getGraphPoint
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