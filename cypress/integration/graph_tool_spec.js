import LeftNav from '../support/elements/LeftNav'
import Canvas from '../support/elements/Canvas'
import GraphToolTile from '../support/elements/GraphToolTile'
import RightNav from '../support/elements/RightNav'
import BottomNav from '../support/elements/BottomNav';
import LearningLog from '../support/elements/LearningLog';
import ImageToolTile from '../support/elements/ImageToolTile'

const leftNav = new LeftNav;
const canvas = new Canvas;
const rightNav = new RightNav;
const learningLog = new LearningLog;
const graphToolTile = new GraphToolTile;

context('Test graph tool functionalities', function(){
    describe('adding points and polygons to a graph', function(){
        it('will add a point to the origin', function(){
            leftNav.openToWorkspace('Extra Workspace');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Extra Workspace');
            canvas.addGraphTile();
            graphToolTile.addPointToGraph(0,0);
            graphToolTile.getGraphPointText().should('have.text', '0,0');
        });
        it('will add points to a graph', function(){
            leftNav.openToWorkspace('Now What');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Now What');
            canvas.addGraphTile();
            graphToolTile.getGraphTile().last().click();
            graphToolTile.addPointToGraph(5,5);
            graphToolTile.addPointToGraph(10,5);
            graphToolTile.addPointToGraph(10,10);
            cy.wait(2000)
        });
        it('will add a polygon to a graph', function(){
            leftNav.openToWorkspace('What if...?');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','What if');
            canvas.addGraphTile();
            graphToolTile.getGraphTile().last().click();
            graphToolTile.addPointToGraph(3.2,4);
            graphToolTile.addPointToGraph(7.4, 2.2);
            graphToolTile.addPointToGraph(13.2,5);
            graphToolTile.addPointToGraph(13.2,5);
            graphToolTile.getGraphPoint().last().click({force:true});
            graphToolTile.getGraphPoint().last().click({force:true});
            graphToolTile.getGraphPolygon().should('exist');
            cy.wait(2000)
        });
    });

    describe('restore points to canvas', function(){
        it('will verify restore of point at origin', function(){
            leftNav.openToWorkspace('Extra Workspace');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Extra Workspace');
            graphToolTile.getGraphPointText().last().should('have.text', '0,0');
        });
        it('will verify restore of polygon', function(){
            leftNav.openToWorkspace('What if...?');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','What if');
            graphToolTile.getGraphPolygon().each(($point, index, $list)=>{
                expect($list).to.have.length(1);
            })
        });
        it('will verify restore of multiple points', function(){
            leftNav.openToWorkspace('Now What');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Now What');
            graphToolTile.getGraphPoint().each(($point, index, $list)=>{
                expect($list).to.have.length(8);
            })
        });

        it('will verify restore of polygon from right nav', function(){
            rightNav.openMyWorkTab();
            rightNav.openMyWorkAreaCanvasItem('What if');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','What if');
            graphToolTile.getGraphPolygon().each(($point, index, $list)=>{
                expect($list).to.have.length(1);
            })
        });
    });

    describe('interact with points and polygons', function(){
        it('will select a point', function(){
            var pointId='';
            graphToolTile.getGraphTile().click();
            graphToolTile.selectGraphPoint(13.2,5);
            pointId=graphToolTile.getGraphPointID();
            cy.log(pointId);
            // graphToolTile.getGraphPointText().should('have.text', '13.2,5');
        });
        // it('will drag a point to a new location', function(){
        //
        // });
        // it('will copy and paste a point', function(){ //cannot send keyboard commands to non-text fields
        //
        // });
        it('will show and hide angles to a polygon', function(){
            //TODO need a way to verify the angles are showing and hidden
            graphToolTile.selectGraphPoint(13.2,5);
            graphToolTile.showAngle();
            graphToolTile.selectGraphPoint(7.4, 2.2);
            graphToolTile.showAngle();
            graphToolTile.selectGraphPoint(3.2,4);
            graphToolTile.showAngle();
            graphToolTile.selectGraphPoint(13.2,5);
            graphToolTile.hideAngle();
            graphToolTile.selectGraphPoint(7.4, 2.2);
            graphToolTile.hideAngle();
            graphToolTile.selectGraphPoint(3.2,4);
            graphToolTile.hideAngle();

            //Add the angles angle for the restore test later
            graphToolTile.selectGraphPoint(13.2,5);
            graphToolTile.showAngle();
            graphToolTile.selectGraphPoint(7.4, 2.2);
            graphToolTile.showAngle();
            graphToolTile.selectGraphPoint(3.2,4);
            graphToolTile.showAngle();
        });
        it('will select a polygon', function(){
            leftNav.openToWorkspace('Introduction');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Introduction');
            canvas.addGraphTile();
            // graphToolTile.getGraphTile().last().click();
            graphToolTile.addPointToGraph(5,5);
            graphToolTile.addPointToGraph(10,5);
            graphToolTile.addPointToGraph(10,10);
            graphToolTile.addPointToGraph(5,10);
            graphToolTile.addPointToGraph(5,10);
            graphToolTile.addPointToGraph(5,10);
            graphToolTile.getGraphPoint().last().click({force:true});
            graphToolTile.getGraphPoint().last().click({force:true});
            cy.wait(2000);
            // graphToolTile.getGraphPointID();
            graphToolTile.getGraphPolygon().click({force:true});
            graphToolTile.getRotateTool().should('be.visible');
        });
        it('will rotate a polygon', function(){
            //not sure how to verify the rotation
            graphToolTile.getRotateTool()
                .trigger('mousedown')
                .trigger('dragstart')
                .trigger('mousemove',28, -73, {force:true})
                .trigger('dragend')
                .trigger('drop')
                .trigger('mouseup');
            //TODO verify points are in new location

        });
        it('will drag a polygon to a new location', function(){ //TODO still not working
                graphToolTile.getGraphPolygon()
                    .trigger('mousedown', {force:true})
                    .trigger('dragstart', {force:true})
                    .trigger('drag',100,150,{force:true})
                    // .trigger('mousemove', 100, 150, {force:true})
                    .trigger('dragend', 100, 150, {force:true})
                    .trigger('drop', 100, 150,{force:true})
                    .trigger('mouseup',{force:true});
        });
        it('will copy and paste a polygon', function(){
            //TODO
        });
        it('will restore changes to a graph', function(){
            leftNav.openToWorkspace('Now What');
            leftNav.openToWorkspace('What if...?');
            //TODO verify angles are showing
            leftNav.openToWorkspace('Introduction');
            //TODO verify polygon is present and rotated

        })
    });



    describe('delete points and polygons', function(){
        it('will delete points with delete tool', function(){ //current behavior of text deletes the entire graph tool tile. Point selection has to be forced
            leftNav.openToWorkspace('Initial Challenge');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Initial Challenge');
            canvas.addGraphTile();
            graphToolTile.addPointToGraph(5,5);
            graphToolTile.addPointToGraph(10,5);
            graphToolTile.addPointToGraph(10,10);
            graphToolTile.addPointToGraph(10,10);
            graphToolTile.addPointToGraph(10,10); //to create the polygon

            graphToolTile.getGraphPoint().each(($point, index, $list)=>{
                expect($list).to.have.length(7);
            });
            graphToolTile.getGraphPoint().last().click({force:true});
            canvas.getDeleteTool().click();
            graphToolTile.getGraphPoint().each(($point, index, $list)=>{
                expect($list).to.have.length(6);
            });
            graphToolTile.getGraphPolygon().should('not.exist');

            graphToolTile.selectGraphPoint(10,5);
            // graphToolTile.getGraphPoint().last().click();
            canvas.getDeleteTool().click();
            graphToolTile.getGraphPoint().each(($point, index, $list)=>{
                expect($list).to.have.length(5);
            });
            graphToolTile.selectGraphPoint(5,5);
            canvas.getDeleteTool().click();
            graphToolTile.getGraphPoint().each(($point, index, $list)=>{
                expect($list).to.have.length(4);
            });
        })
        // it('will delete points with keyboard', function(){ //current cypress behavior does not allow for "typing" into non-text field
        //     leftNav.openToWorkspace('Initial Challenge');
        //     cy.wait(2000);
        //     canvas.getCanvasTitle().should('contain','Initial Challenge');
        //     canvas.addGraphTile();
        //     graphToolTile.getGraphTile().last().click();
        //     graphToolTile.getGraphTile().last().click(40,35, {force:true});
        //     graphToolTile.getGraphTile().last().click(140,70, {force:true});
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(7);
        //     });
        //     graphToolTile.getGraphPoint().last().click({force:true});
        //     graphToolTile.getGraphPoint().last().type('{backspace}');
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(6);
        //     });
        //     graphToolTile.getGraphPoint().last().click({force:true});
        //     graphToolTile.getGraphPoint().last().type('{del}');
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(5);
        //     });
        //     graphToolTile.getGraphPoint().last().click();
        //     canvas.getDeleteTool().click();
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(4);
        //     });
        // })
    })

});
