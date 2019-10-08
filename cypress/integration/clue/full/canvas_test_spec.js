import LeftNav from '../../../support/elements/clue/LeftNav'
import Canvas from '../../../support/elements/common/Canvas'
import ClueCanvas from '../../../support/elements/clue/cCanvas'
import RightNav from '../../../support/elements/common/RightNav'
import GraphToolTile from '../../../support/elements/clue/GraphToolTile'
import ImageToolTile from '../../../support/elements/clue/ImageToolTile'
import DrawToolTile from '../../../support/elements/clue/DrawToolTile'
import TextToolTile from '../../../support/elements/clue/TextToolTile'
import TableToolTile from '../../../support/elements/clue/TableToolTile'

let leftNav = new LeftNav;
let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let rightNav = new RightNav;
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
            it('verify investigation header UI',()=>{ // element functionality are tested in common
                //should have create new document
                //should have copy document
                //should not have delete document
                //should not have edit title button
                //should have publish document
                //should have share in 4 up
                //should have 4up toggle
            })
            it('verify personal workspace header UI',()=>{ //other header elements are tested in common
                //should not have share in 4 up
                //should not have 4up toggle
            })

            it('verifies views button changes when clicked and shows the correct corresponding workspace view', function(){
                //1-up view has 4-up button visible and 1-up canvas
                clueCanvas.getFourUpViewToggle().should('be.visible');
                canvas.getSingleCanvas().should('be.visible');
                clueCanvas.getFourUpView().should('not.be.visible');
                clueCanvas.openFourUpView();
                //4-up view is visible and 1-up button is visible
                clueCanvas.getFourToOneUpViewToggle().should('be.visible');
                clueCanvas.getNorthEastCanvas().should('be.visible');
                clueCanvas.getNorthWestCanvas().should('be.visible');
                clueCanvas.getSouthEastCanvas().should('be.visible');
                clueCanvas.getSouthEastCanvas().should('be.visible');
                // canvas.getSingleCanvas().should('not.be.visible');

                //can get back to 1 up view from 4 up
                clueCanvas.openOneUpViewFromFourUp();
                canvas.getSingleCanvas().should('be.visible');
                clueCanvas.getFourUpViewToggle().should('be.visible');
                clueCanvas.getFourUpView().should('not.be.visible');
            });

            it('verify share button toggles correctly', function(){
                clueCanvas.getShareButton().should('be.visible');
                clueCanvas.getShareButton().parent().should('have.class', 'private');
                clueCanvas.shareCanvas();
                clueCanvas.getShareButton().parent().should('have.class', 'public');
                clueCanvas.unshareCanvas();
                clueCanvas.getShareButton().parent().should('have.class', 'private');
            });
        }) ;

        describe('test 4-up view', function(){
            it('will drag the center point and verify that canvases resize', function(){
                clueCanvas.openFourUpView();
                cy.get('.four-up .center')
                    .trigger('dragstart')
                    .trigger('mousemove',100, 250, {force:true})
                    .trigger('drop');
                clueCanvas.openOneUpViewFromFourUp(); //clean up
            });
        });

        context('test the tool palette', function(){//This should test the tools in the tool shelf
            // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
            //Selection tool is tested as a functionality of graph tool tiles

            it('adds text tool', function(){
                clueCanvas.addTile('text');
                textToolTile.getTextTile().should('exist');
            });
            it('adds a graph tool', function(){
                clueCanvas.addTile('geometry');
                graphToolTile.getGraphTile().should('exist');
            });
            it('adds an image tool', function(){
                clueCanvas.addTile('image');
                imageToolTile.getImageTile().should('exist');
            });
            it('adds a draw tool', function(){
                clueCanvas.addTile('drawing');
                drawToolTile.getDrawTile().should('exist');
            });
            it('adds a table tool', function(){
                clueCanvas.addTile('table');
                tableToolTile.getTableTile().should('exist');
            });
            it('verifies scrolling', function(){
                tableToolTile.getTableTile().scrollIntoView().click();
                textToolTile.getTextTile().first().scrollIntoView();
            });
            it('verifies scrolling in 4up view', function(){
                clueCanvas.openFourUpView();
                // canvas.scrollToBottom(clueCanvas.getNorthWestCanvas());
                tableToolTile.getTableTile().scrollIntoView().click();
                tableToolTile.getTableTile().last().should('be.visible');
                textToolTile.getTextTile().first().scrollIntoView();
                clueCanvas.getSouthWestCanvas().should('be.visible');
            });
            after(()=>{
                clueCanvas.openOneUpViewFromFourUp(); //clean up           
            })
        });

        context('save and restore of tool tiles', function(){
            //TODO: add verification that document is saved and sorted to the correct section in right nav 
            //(ie personal docs=>my work:workspaces, investigations=>my-work:investigation, learning log=>my work:learning log)
            describe('verify that canvas is saved from various locations', function(){
                it('will restore from My Work tab', function() {
                    let canvas1='New Doc Edit';
                    let canvas2="Drawing Wumps";

                    //restore canvas from personal workspace section
                    rightNav.openRightNavTab('my-work');
                    rightNav.openSection('my-work','workspaces');
                    rightNav.openCanvasItem('my-work','workspaces', canvas1);
                    canvas.getPersonalDocTitle().should('contain', canvas1)
                    graphToolTile.getGraphTile().should('be.visible');
                    textToolTile.getTextTile().should('be.visible');
                    tableToolTile.getTableTile().should('not.be.visible');

                    //restore canvas from investigation section
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','investigations',canvas2);
                    clueCanvas.getInvestigationCanvasTitle().should('contain', canvas2)
                    //verify canvas is still in 4up view
                    clueCanvas.getFourUpView().should('be.visible')
                    //verify text element with Hello World in showing
                    textToolTile.getTextTile().first().should('contain', 'Hello World');
                    graphToolTile.getGraphTile().should('be.visible')
                });
            });

            describe('verify that if user leaves a canvas in four-up view, restore is also in four up view', function(){
                //TODO need to verify expected behavior when switching from canvas to canvas whether 4-up view should stay up.
                // TODO Replace save and restore of documents
                // it('verify canvas stays in 4up view when changing canvases', ()=>{
                //     // leftNav.openToWorkspace('Initial Challenge');
                //     // canvas.getCanvasTitle().should('contain','Initial Challenge');
                //     canvas.openFourUpView();
                //     canvas.getFourUpView().should('be.visible');
                //     leftNav.openToWorkspace('What if...?');
                //     canvas.getCanvasTitle().should('contain','What if');
                //     canvas.getFourUpView().should('be.visible');
                //     rightNav.openMyWorkTab();
                //     rightNav.openMyWorkAreaCanvasItem("Initial Challenge");
                //     canvas.getCanvasTitle().should('contain','Initial Challenge');

                //     canvas.openOneUpViewFromFourUp(); //clean up
                // });
            });
        });

        context('test footer elements', function(){
            describe('Test supports area', function(){
                it.skip('verify supports comes up correctly', function(){
                    canvas.getSupportList().each(($support, index, $list)=>{
                        let label=$support.text();
                        cy.wrap($support).click();
                        canvas.getSupportTitle().should('contain', label);
                    });
                });
            });
            describe('Test the 2-up view', function(){
                it('verify 2 up button, and correct corresponding view comes up', function(){
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    clueCanvas.openTwoUpView();
                    clueCanvas.openOneUpViewFromTwoUp();
                    clueCanvas.getRightSideWorkspace().should('not.be.visible');
                    clueCanvas.getLeftSideWorkspace().should('not.be.visible');
                    canvas.getSingleCanvas().should('be.visible');
                });

                it('verify 2-up view is visible when canvas is in 4-up view', function(){
                    //single canvas 4up button and 2up button is visible
                    clueCanvas.getFourUpViewToggle().should('be.visible');
                    clueCanvas.getNorthEastCanvas().should('not.be.visible');
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    //change to 4up view and verify 2 up button is still visible
                    clueCanvas.openFourUpView();
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    //Click on 2up button, and verify right hand canvas and 2up toggle is visible
                    clueCanvas.openTwoUpView();
                    clueCanvas.getRightSideWorkspace().should('be.visible');
                    clueCanvas.getLeftSideFourUpView().should('be.visible');
                    //Verify that user can get back to 4 up view
                    clueCanvas.getTwoToOneUpViewToggle().should('be.visible').click();
                    clueCanvas.getRightSideWorkspace().should('not.be.visible');
                    clueCanvas.getFourUpView().should('be.visible');
                    //Verify user can get back to single canvas
                    clueCanvas.getFourToOneUpViewToggle().should('be.visible').click();
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    clueCanvas.getFourUpViewToggle().should('be.visible');
                });
                // TODO: Learning logs has changed with the new feature changes
                it.skip('verify learning log canvas side by side in right side 2 up view', function() {
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
                    // learningLog.getRightSideWorkspaceTitle().should('contain','Initial');
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
                // TODO: Learning logs has changed with new feature changes
                it.skip('verify canvas side by side in right side 2 up view', function(){
                    //open the 2up view
                    clueCanvas.openTwoUpView();
                    clueCanvas.getRightSideWorkspace().should('be.visible');
                    //verify tool palette is present in left side workspace
                    clueCanvas.getLeftSideToolPalette().should('be.visible');
                    //add a canvas to the rightside workspace from My Work
                    rightNav.openMyWorkTab();
                    //verify tool palette is not present in the rightside workspace
                    canvas.getRightSideToolPalette().should('not.exist');
                    //add a canvas from Class work to rightside workspace
                    rightNav.openClassWorkTab();
                    // rightNav.getAllClassWorkAreaCanvasItems().first().then(($el)=>{
                    //     let title = $el.text().split('Student')[0];
                    //     cy.wrap($el).click();
                    //     canvas.getRightSideWorkspaceTitle().should('contain',title);
                    // });
                    rightNav.openClassLogTab();
                    rightNav.openClassLogAreaCanvasItem('pool');
                    clueCanvas.getRightSideLLTitle().should('contain','pool');

                });
                //TODO add a test for dragging canvas to the left side workspace
                //TODO: add a test for when both views are the same section (Open an intro, put it into workspace, change to 2 up view, drag intro to 2nd space, open intro again, switching back to 1 up view disappears
                //from https://www.pivotaltracker.com/story/show/160826065
                // TODO: 4-up views are not being restored properly.
                it.skip('verify that 2-up and 4-up views are restored properly', function(){
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    clueCanvas.openFourUpView();
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    clueCanvas.openTwoUpView();
                    clueCanvas.getFourUpView().should('be.visible');
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    clueCanvas.getRightSideWorkspace().should('not.be.visible');
                    clueCanvas.openOneUpViewFromFourUp(); //clean up
                });
            });
        });
    });

    context('Dragging elements from different locations to canvas', function(){
        describe('Drag element from left nav', function(){
            const dataTransfer = new DataTransfer;
            // TODO: Unable to get elements
            it.skip('will drag an image from left nav to canvas',()=>{
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

    // TODO: Unable to get and return the delete methods in Canvas
    context('delete elements from canvas', function(){
        it.skip('will delete elements from canvas', function(){
            // //Delete elements in the canvas
            clueCanvas.deleteTile('graph');
            clueCanvas.deleteTile('image');
            clueCanvas.deleteTile('draw');
            clueCanvas.deleteTile('table');
            clueCanvas.deleteTile('text');
            clueCanvas.deleteTile('text');
            textToolTile.getTextTile().should('not.exist');
            graphToolTile.getGraphTile().should('not.exist');
            drawToolTile.getDrawTile().should('not.exist');
            // imageToolTile.getImageTile().should('not.exist');
            tableToolTile.getTableTile().should('not.exist');
        });
    });
});