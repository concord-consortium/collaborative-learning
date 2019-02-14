import LeftNav from '../support/elements/LeftNav'
import Canvas from '../support/elements/Canvas'
import RightNav from '../support/elements/RightNav'
import BottomNav from '../support/elements/BottomNav';
import LearningLog from '../support/elements/LearningLog';
import GraphToolTile from '../support/elements/GraphToolTile'
import ImageToolTile from '../support/elements/ImageToolTile'
import DrawToolTile from '../support/elements/DrawToolTile'
import TextToolTile from '../support/elements/TextToolTile'
import TableToolTile from '../support/elements/TableToolTile'

let leftNav = new LeftNav;
let canvas = new Canvas;
let rightNav = new RightNav;
let learningLog = new LearningLog;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;


context('Test Canvas', function(){
    //TODO: Tests to add to canvas:
    // 1. reorder tiles
    // 3. drag image from leftNav to canvas
    // 5. drag a tool from tool bar to canvas

    context('test canvas tools', function(){
        describe('test header elements', function(){
            it('verifies header title appears correctly', function(){
                leftNav.openToWorkspace('Introduction');
                canvas.getCanvasTitle().should('contain','Introduction');
            });

            it('verifies views button changes when clicked and shows the correct corresponding workspace view', function(){
                //1-up view has 4-up button visible and 1-up canvas
                canvas.getFourUpViewToggle().should('be.visible');
                canvas.getSingleCanvas().should('be.visible');
                canvas.getFourUpView().should('not.be.visible');
                canvas.openFourUpView();
                //4-up view is visible and 1-up button is visible
                canvas.getFourToOneUpViewToggle().should('be.visible');
                canvas.getNorthEastCanvas().should('be.visible');
                canvas.getNorthWestCanvas().should('be.visible');
                canvas.getSouthEastCanvas().should('be.visible');
                canvas.getSouthEastCanvas().should('be.visible');
                // canvas.getSingleCanvas().should('not.be.visible');

                //can get back to 1 up view from 4 up
                canvas.openOneUpViewFromFourUp();
                canvas.getSingleCanvas().should('be.visible');
                canvas.getFourUpViewToggle().should('be.visible');
                canvas.getFourUpView().should('not.be.visible');
            });

            it('verify share button', function(){
                canvas.getShareButton().should('be.visible');
                canvas.getUnshareButton().should('not.be.visible');
                canvas.shareCanvas();
                canvas.getShareButton().should('not.be.visible');
                canvas.getUnshareButton().should('be.visible');
                canvas.unshareCanvas();
                canvas.getShareButton().should('be.visible');
                canvas.getUnshareButton().should('not.be.visible');
            });
            it('verify publish button', function(){
                canvas.publishCanvas();
                canvas.getPublishIcon().should('exist');
            });
        }) ;

        describe('test 4-up view', function(){
            it('will drag the center point and verify that canvases resize', function(){
                canvas.openFourUpView();
                cy.get('.four-up .center')
                    .trigger('dragstart')
                    .trigger('mousemove',100, 250, {force:true})
                    .trigger('drop');
                canvas.openOneUpViewFromFourUp(); //clean up
            });
        });

        context('test the tool palette', function(){//This should test the tools in the tool shelf
            // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
            //Selection tool is tested as a functionality of graph tool tiles

            it('adds text tool', function(){
                canvas.addTextTile();
                textToolTile.getTextTile().should('exist');
            });
            it('adds a graph tool', function(){
                canvas.addGraphTile();
                graphToolTile.getGraphTile().should('exist');
            });
            it('adds an image tool', function(){
                canvas.addImageTile();
                imageToolTile.getImageTile().should('exist');
            });
            it('adds a draw tool', function(){
                canvas.addDrawTile();
                drawToolTile.getDrawTile().should('exist');
            });
            it('adds a table tool', function(){
                canvas.addTableTile();
                tableToolTile.getTableTile().should('exist');
            });
            it('verifies scrolling', function(){
                canvas.scrollToBottom(canvas.getSingleCanvasDocumentContent());
                canvas.scrollToTop(canvas.getSingleCanvasDocumentContent());
            });
            // TODO:4-up view canvas selector does not work in cypress even though it works in Chrome. it currently selects the entire canvas and not the scaled one
            // it('verifies scrolling in 4up view', function(){
            //      canvas.openFourUpView();
            //      canvas.scrollToBottom(canvas.getNorthWestCanvas());
            //     // cy.get('.single-workspace > .document> .canvas-area > .four-up > .canvas-container.north-west >.canvas-scaler >.canvas').scrollTo('bottom');
            //     canvas.getGraphTile().last().should('be.visible');
            //     canvas.getSouthWestCanvas().should('be.visible');
            //     canvas.openOneUpViewFromFourUp(); //clean up
            //
            // });
        });

        context('save and restore of canvas', function(){
            describe('verify that canvas is saved from various locations', function(){
                it('will restore from My Work tab', function() {
                    //TODO need to figure out why the page object commands do not work for opening Introduction canvas
                    let canvas1='Initial Challenge';
                    let canvas2='Introduction';
                    // //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing
                    leftNav.openToWorkspace(canvas1);
                    canvas.getCanvasTitle().should('contain',canvas1);
                    leftNav.openToWorkspace(canvas2);
                    canvas.getCanvasTitle().should('contain',canvas2);
                    rightNav.openMyWorkTab();
                    rightNav.openMyWorkAreaCanvasItem(canvas1);
                    canvas.getCanvasTitle().should('contain', canvas1);
                    // rightNav.closeMyWorkTab();
                    rightNav.openMyWorkTab();
                    rightNav.openMyWorkAreaCanvasItem(canvas2);
                    canvas.getCanvasTitle().should('contain', canvas2);

                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');

                    //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing
                    // cy.get('#leftNavTab1').click();
                    // cy.get('#leftNavContainer1 > .left-nav-panel > .section > .canvas > .document-content > .buttons > button').click();
                    // cy.get('.single-workspace > .document > .titlebar > .title').should('contain','Initial');
                    // cy.get('#rightNavTabMy\\ Work').click({force:true});
                    // cy.get('.list > .list-item[title*="Initial"]').click();
                    // cy.get('.single-workspace > .document > .titlebar > .title').should('contain', 'Initial');
                    // cy.get('#rightNavTabMy\\ Work').click({force:true});
                    // cy.get('.list > .list-item[title*="Introduction"]').click();
                    // cy.get('.single-workspace > .document > .titlebar > .title').should('contain', 'Introduction');

                    //verify text element with Hello World in showing
                    // canvas.getTextTile().first().should('contain', 'Hello World');
                });
            });

            describe('verify that if user opens same canvas from on left-nav tab, saved canvas opens', function() {
                it('will restore from left nav', function() {
                    leftNav.openToWorkspace('What if...?');
                    canvas.getCanvasTitle().should('contain', 'What if');
                    leftNav.openToWorkspace('Introduction');
                    canvas.getCanvasTitle().should('contain','Introduction');
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                });
            });

            describe('verify that if user leaves a canvas in four-up view, restore is also in four up view', function(){
                //TODO need to verify expected behavior when switching from canvas to canvas whether 4-up view should stay up.
                it('verify canvas stays in 4up view when changing canvases', ()=>{
                    leftNav.openToWorkspace('Initial Challenge');
                    canvas.getCanvasTitle().should('contain','Initial Challenge');
                    canvas.openFourUpView();
                    canvas.getFourUpView().should('be.visible');
                    leftNav.openToWorkspace('What if...?');
                    canvas.getCanvasTitle().should('contain','What if');
                    canvas.getFourUpView().should('be.visible');
                    rightNav.openMyWorkTab();
                    rightNav.openMyWorkAreaCanvasItem("Initial Challenge");
                    canvas.getCanvasTitle().should('contain','Initial Challenge');

                    canvas.openOneUpViewFromFourUp(); //clean up
                });
            });
        });

        context('test footer elements', function(){
            describe('Test supports area', function(){
                it('verify supports comes up correctly', function(){
                    canvas.getSupportList().each(($support, index, $list)=>{
                        let label=$support.text();
                        cy.wrap($support).click();
                        canvas.getSupportTitle().should('contain', label);
                    });
                });
            });
            describe('Test the 2-up view', function(){
                it('verify 2 up button, and correct corresponding view comes up', function(){
                    canvas.getTwoUpViewToggle().should('be.visible');
                    canvas.openTwoUpView();
                    canvas.openOneUpViewFromTwoUp();
                    canvas.getRightSideWorkspace().should('not.be.visible');
                    canvas.getLeftSideWorkspace().should('not.be.visible');
                    canvas.getSingleCanvas().should('be.visible');
                });

                it('verify 2-up view is visible when canvas is in 4-up view', function(){
                    //single canvas 4up button and 2up button is visible
                    canvas.getFourUpViewToggle().should('be.visible');
                    canvas.getNorthEastCanvas().should('not.be.visible');
                    canvas.getTwoUpViewToggle().should('be.visible');
                    //change to 4up view and verify 2 up button is still visible
                    canvas.openFourUpView();
                    canvas.getTwoUpViewToggle().should('be.visible');
                    //Click on 2up button, and verify right hand canvas and 2up toggle is visible
                    canvas.openTwoUpView();
                    canvas.getRightSideWorkspace().should('be.visible');
                    canvas.getLeftSideFourUpView().should('be.visible');
                    //Verify that user can get back to 4 up view
                    canvas.getTwoToOneUpViewToggle().should('be.visible').click();
                    canvas.getRightSideWorkspace().should('not.be.visible');
                    canvas.getFourUpView().should('be.visible');
                    //Verify user can get back to single canvas
                    canvas.getFourToOneUpViewToggle().should('be.visible').click();
                    canvas.getTwoUpViewToggle().should('be.visible');
                    canvas.getFourUpViewToggle().should('be.visible');
                });

                it('verify learning log canvas side by side in right side 2 up view', function() {
                    learningLog.createLearningLog('pool'); //setup
                    //open 2up view
                    learningLog.openTwoUpView();
                    learningLog.getRightSideWorkspace().should('be.visible');
                    //verify that canvas is in the left side workspace
                    learningLog.getLeftSideWorkspaceTitle().should('contain','pool');
                    //verify that tool palette is present in left side workspace
                    learningLog.getLeftSideToolPalette().should('be.visible');
                    //add a canvas to the right side workspace from My Work
                    rightNav.openMyWorkTab();
                    rightNav.openMyWorkAreaCanvasItem('Initial Challenge');
                    learningLog.getRightSideWorkspaceTitle().should('contain','Initial');
                    //verify tool palette is not present in the right side workspace
                    learningLog.getRightSideToolPalette().should('not.exist');
                    //add a canvas to the right side workspace from Class Work
                    rightNav.openClassWorkTab();
                    rightNav.openClassWorkSections();
                    rightNav.getAllClassWorkAreaCanvasItems().first().then(($el)=>{
                        let title = $el.text().split('Student')[0];
                        cy.wrap($el).click();
                        learningLog.getRightSideWorkspaceTitle().should('contain',title);
                    });
                    learningLog.closeLearningLogTab();//close learning log tab because createLearningLog opens it again
                    //create second learning log to put up in 2 up view
                    learningLog.createLearningLog('slide');
                    learningLog.publishLearningLog(); //to use for next test
                    //add a canvas to the right side workspace from Learning log
                    learningLog.openLearningLogCanvasItem('slide');
                    learningLog.getRightSideWorkspaceTitle().should('contain','slide');
                });

                it('verify canvas side by side in right side 2 up view', function(){
                    //open the 2up view
                    let tab = 'What if...?';
                    leftNav.openToWorkspace(tab);
                    canvas.getCanvasTitle().should('contain',tab);
                    canvas.openTwoUpView();
                    canvas.getRightSideWorkspace().should('be.visible');
                    //verify that canvas is in the left side workspace
                    canvas.getLeftSideWorkspaceTitle().should('contain','What if');
                    //verify tool palette is present in left side workspace
                    canvas.getLeftSideToolPalette().should('be.visible');
                    //add a canvas to the rightside workspace from My Work
                    rightNav.openMyWorkTab();
                    rightNav.openMyWorkAreaCanvasItem('Initial Challenge');
                    canvas.getRightSideWorkspaceTitle().should('contain','Initial');
                    //verify tool palette is not present in the rightside workspace
                    canvas.getRightSideToolPalette().should('not.exist');
                    //add a canvas from Class work to rightside workspace
                    rightNav.openClassWorkTab();
                    rightNav.getAllClassWorkAreaCanvasItems().first().then(($el)=>{
                        let title = $el.text().split('Student')[0];
                        cy.wrap($el).click();
                        canvas.getRightSideWorkspaceTitle().should('contain',title);
                    });
                    rightNav.openClassLogTab();
                    rightNav.openClassLogAreaCanvasItem('pool');
                    canvas.getRightSideLLTitle().should('contain','pool');

                });

                //TODO add a test for dragging canvas to the left side workspace

                //TODO: add a test for when both views are the same section (Open an intro, put it into workspace, change to 2 up view, drag intro to 2nd space, open intro again, switching back to 1 up view disappears
                //from https://www.pivotaltracker.com/story/show/160826065
                it('verify that 2-up and 4-up views are restored properly', function(){
                    leftNav.openToWorkspace('Introduction');
                    canvas.getCanvasTitle().should('contain','Introduction');
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    canvas.openFourUpView();
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    leftNav.openToWorkspace('What if...?');
                    canvas.getCanvasTitle().should('contain','What if');
                    canvas.openTwoUpView();
                    leftNav.openToWorkspace('Introduction');
                    canvas.getCanvasTitle().should('contain','Introduction');
                    canvas.getFourUpView().should('be.visible');
                    canvas.getTwoUpViewToggle().should('be.visible');
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    canvas.getRightSideWorkspace().should('not.be.visible');
                    canvas.openOneUpViewFromFourUp(); //clean up
                });
            });
        });
    });

    context('Dragging elements from different locations to canvas', function(){
       describe('Drag element from left nav', function(){
           const dataTransfer = new DataTransfer;

           it('will drag an image from left nav to canvas',()=>{
               leftNav.openToWorkspace('Extra Workspace');
               cy.wait(1000);
               leftNav.openLeftNavTab('Introduction');
               leftNav.getLeftNavExpandedSpace().find('.image-tool').first()
                   .trigger('dragstart', {dataTransfer});
               // cy.get('.single-workspace .canvas .drop-feedback').first()
               cy.get('.single-workspace .canvas .document-content').first()
                   .trigger('drop', {force: true, dataTransfer});
               leftNav.getLeftNavExpandedSpace().find('.image-tool').first()
                   .trigger('dragend');
               leftNav.closeLeftNavTab('Introduction');
               imageToolTile.getImageTile().first().should('exist');
           })
       });
    });

    context('delete elements from canvas', function(){
        it('will delete elements from canvas', function(){
            // //Delete elements in the canvas
            leftNav.openToWorkspace('Introduction');
            canvas.deleteTile('graph');
            canvas.deleteTile('image');
            canvas.deleteTile('draw');
            canvas.deleteTile('table');
            canvas.deleteTile('text');
            canvas.deleteTile('text');
            textToolTile.getTextTile().should('not.exist');
            graphToolTile.getGraphTile().should('not.exist');
            drawToolTile.getDrawTile().should('not.exist');
            imageToolTile.getImageTile().should('not.exist');
            tableToolTile.getTableTile().should('not.exist');
        });


    });

});