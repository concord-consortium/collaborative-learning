import LeftNav from './elements/LeftNav'
import Canvas from './elements/Canvas'
import GraphToolTile from './elements/GraphToolTile'
import RightNav from './elements/RightNav'
import BottomNav from './elements/BottomNav';
import LearningLog from './elements/LearningLog';
import ImageToolTile from './elements/ImageToolTile'

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
          graphToolTile.getGraphTile().last().click(12,208, {force:true});
          graphToolTile.getGraphPointText().should('have.text', '0,0');
        });
        it('will add points to a graph', function(){
            leftNav.openToWorkspace('Now What');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Now What');
            canvas.addGraphTile();
            graphToolTile.getGraphTile().last().click();
            graphToolTile.getGraphTile().last().click(40,35, {force:true});
            graphToolTile.getGraphTile().last().click(140,70, {force:true});
            graphToolTile.getGraphTile().last().click(260,50, {force:true});
            cy.wait(2000)
        });
        it('will add a polygon to a graph', function(){
            leftNav.openToWorkspace('What if');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','What if');
            canvas.addGraphTile();
            graphToolTile.getGraphTile().last().click();
            graphToolTile.getGraphTile().last().click(40,35, {force:true});
            graphToolTile.getGraphTile().last().click(140,70, {force:true});
            graphToolTile.getGraphTile().last().click(260,50, {force:true});
            graphToolTile.getGraphTile().last().click(260,50, {force:true});
            graphToolTile.getGraphPoint().last().click({force:true});
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
            leftNav.openToWorkspace('What if');
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

        });
        it('will drag a point to a new location', function(){

        });
        it('will copy and paste a point', function(){

        });
        it('will select a polygon', function(){
            leftNav.openToWorkspace('Introduction');
            cy.wait(2000);
            canvas.getCanvasTitle().should('contain','Introduction');
            canvas.addGraphTile();
            graphToolTile.getGraphTile().last().click();
            graphToolTile.getGraphTile().last().click(40,35, {force:true});
            graphToolTile.getGraphTile().last().click(140,70, {force:true});
            graphToolTile.getGraphTile().last().click(260,50, {force:true});
            graphToolTile.getGraphTile().last().click(260,50, {force:true});
            graphToolTile.getGraphPoint().last().click({force:true});
            cy.wait(2000)
            // graphToolTile.getGraphPointID();
            graphToolTile.getGraphPolygon().click({force:true});
            graphToolTile.getRotateTool().should('be.visible');
        });
        it('will rotate a polygon', function(){
            //not sure how to verify the rotation
            graphToolTile.getRotateTool()
                .trigger('mousedown')
                .trigger('dragstart')
                .trigger('mousemove',-50, 100, {force:true})
                .trigger('dragend')
                .trigger('drop')
                .trigger('mouseup');
        });
        it('will drag a polygon to a new location', function(){
                graphToolTile.getGraphPolygon()
                    .trigger('dragstart',50,100,{force:true})
                    .trigger('drag',100,250,{force:true})
                    // .trigger('mousemove',100, 150, {force:true})
                    .trigger('drop',{force:true})
                    .trigger('mouseup',{force:true});
        });
        it('will copy and paste a polygon', function(){

        });
    });

    describe('delete points and polygons', function(){
        // it('will delete points with delete tool', function(){ //current behavior of text deletes the entire graph tool tile. Point selection has to be forced
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
        //     canvas.getDeleteTool().click();
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(6);
        //     });
        //     graphToolTile.getGraphPoint().last().click();
        //     canvas.getDeleteTool().click();
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(5);
        //     });
        //     graphToolTile.getGraphPoint().last().click();
        //     canvas.getDeleteTool().click();
        //     graphToolTile.getGraphPoint().each(($point, index, $list)=>{
        //         expect($list).to.have.length(4);
        //     });
        // })
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
