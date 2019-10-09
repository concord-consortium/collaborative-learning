import LeftNav from '../../../support/elements/clue/LeftNav'
import Canvas from '../../../support/elements/common/Canvas'
import RightNav from '../../../support/elements/common/RightNav'
import GraphToolTile from '../../../support/elements/clue/GraphToolTile'
import ImageToolTile from '../../../support/elements/clue/ImageToolTile'
import DrawToolTile from '../../../support/elements/clue/DrawToolTile'
import TextToolTile from '../../../support/elements/clue/TextToolTile'
import TableToolTile from '../../../support/elements/clue/TableToolTile'
import ClueCanvas from '../../../support/elements/clue/cCanvas';
import Dialog from '../../../support/elements/common/Dialog'

let leftNav = new LeftNav;
let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let rightNav = new RightNav;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;
let dialog = new Dialog


context('Test Canvas', function(){
    //TODO: Tests to add to canvas:
    // 1. reorder tiles
    // 3. drag image from leftNav to canvas
    // 5. drag a tool from tool bar to canvas

    context('test canvas tools', function(){
        describe('test header elements', function(){
            //TODO: add copy doc tests
            it('verifies initial state of UI elements',()=>{
                clueCanvas.getFourUpViewToggle().should('be.visible');
                clueCanvas.getFourToOneUpViewToggle().should('not.be.visible');
                clueCanvas.getShareButton().should('be.visible');
                canvas.getPublishIcon().should('be.visible');
                canvas.getNewDocumentIcon().should('be.visible');
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
            it('verify share button', function(){
                clueCanvas.getShareButton().should('be.visible');
                clueCanvas.shareCanvas();
                clueCanvas.getShareButton().should('be.visible');
                clueCanvas.unshareCanvas();
                clueCanvas.getShareButton().should('be.visible');
            });
            it('verify publish button', function(){
                canvas.publishCanvas();
                canvas.getPublishIcon().should('exist');
            });
            it('verify new document button', function(){
                let title = 'New Doc'
                canvas.createNewProblemDocument(title);
                canvas.getPersonalDocTitle().should('contain', title)
                canvas.getEditTitleIcon().should('be.visible')
                clueCanvas.getFourUpViewToggle().should('not.exist')
            });
            it('verify edit document title', function(){
                let title2 = 'New Doc Edit'    
                canvas.getEditTitleIcon().click()            
                    .then(()=>{
                        dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
                        dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title2);
                        dialog.getDialogOKButton().click();
                    })
                canvas.getPersonalDocTitle().should('contain', title2)

                // Add a tool tile for save and restore test later
                clueCanvas.addTile('geometry');
            });
            it('verify cancel of edit document title', function(){   
                let title2 = 'New Doc Edit' 
                canvas.getEditTitleIcon().click()            
                    .then(()=>{
                        dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
                        dialog.getDialogTextInput().click().type('{selectall}{backspace}');
                        dialog.getDialogCancelButton().click();
                    })
                canvas.getPersonalDocTitle().should('contain', title2)
            });
        }) ;

        describe('test 4-up view', function(){
            before(()=>{//need to open an investigation because personal docs do not have 4 up view
                let investigationTitle = "Drawing Wumps";
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work','investigations');
                rightNav.openCanvasItem('my-work','investigations', investigationTitle)
            })
            it('will drag the center point and verify that canvases resize', function(){
                clueCanvas.openFourUpView();
                cy.get('.four-up .center')
                    .trigger('dragstart')
                    .trigger('mousemove',100, 250, {force:true})
                    .trigger('drop');
                    clueCanvas.openOneUpViewFromFourUp(); //clean up
            });
        });

        describe('test the tool palette', function(){//This should test the tools in the tool shelf
            // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
            //Selection tool is tested as a functionality of graph tool tiles

            it('adds text tool', function(){
                clueCanvas.addTile('text');
                textToolTile.getTextTile().should('exist');
                textToolTile.getTextTile().type('Hello World!')
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
                tableToolTile.getTableTile().first().scrollIntoView().click();
                textToolTile.getTextTile().first().scrollIntoView();
            });
            after(()=>{ //to be used for save and restore test later
                clueCanvas.openFourUpView();
            })
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
            //TODO: add verification that document is saved and sorted to the correct section in right nav 
            //(ie personal docs=>my work:workspaces, investigations=>my-work:investigation, learning log=>my work:learning log)
            let canvas1='New Doc Edit';
            let canvas2="Drawing Wumps";
            describe('verify that canvas is saved from various locations', function(){
                it('will restore from My Work tab', function() {
                    // let canvas1='New Doc Edit';
                    // let canvas2="Drawing Wumps";

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
        });

        context('test footer elements', function(){
            let canvas1='New Doc Edit';

            describe('Test the 2-up view', function(){
                it('verify 2-up view is visible when canvas is in 4-up view', function(){
                    //canvas is already in 4 up view from previous test
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                });
                it('verify right hand canvas and 2up toggle is visible',()=>{
                    clueCanvas.openTwoUpView();
                    clueCanvas.getRightSideWorkspace().should('be.visible');
                    clueCanvas.getLeftSideFourUpView().should('be.visible');
                })  
                it('Verify that user can get back to 4 up view',()=>{
                    clueCanvas.getTwoToOneUpViewToggle().should('be.visible').click();
                    clueCanvas.getRightSideWorkspace().should('not.be.visible');
                    clueCanvas.getFourUpView().should('be.visible');
                })
                it('Verify user can get back to single canvas',()=>{
                    clueCanvas.getFourToOneUpViewToggle().should('be.visible').click();
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    clueCanvas.getFourUpViewToggle().should('be.visible');
                })  
                it('single canvas 4up button and 2up button is visible',()=>{
                    clueCanvas.getFourUpViewToggle().should('be.visible');
                    clueCanvas.getNorthEastCanvas().should('not.be.visible');
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                })
                it('verify 2 up button, and correct corresponding view comes up', function(){
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    clueCanvas.openTwoUpView();
                    clueCanvas.getRightSideWorkspace().should('be.visible');
                    //verify tool palette is present in left side workspace
                    clueCanvas.getLeftSideToolPalette().should('be.visible');
                    //add a canvas to the rightside workspace from My Work
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','workspaces',canvas1)
                    //verify tool palette is not present in the rightside workspace
                    clueCanvas.getRightSideWorkspaceTitle().should('contain', canvas1)
                    clueCanvas.getRightSideToolPalette().should('not.exist');
                    clueCanvas.openOneUpViewFromTwoUp();
                    clueCanvas.getRightSideWorkspace().should('not.be.visible');
                    clueCanvas.getLeftSideWorkspace().should('not.be.visible');
                    canvas.getSingleCanvas().should('be.visible');
                });
            // });
                it.skip('verify canvas side by side in right side 2 up view', function(){
                    //open the 2up view
                    canvas.openTwoUpView();
                    canvas.getRightSideWorkspace().should('be.visible');
                    //verify tool palette is present in left side workspace
                    canvas.getLeftSideToolPalette().should('be.visible');
                    //add a canvas to the rightside workspace from My Work
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','workspaces',canvas1)
                    //verify tool palette is not present in the rightside workspace
                    clueCanvas.getRightSideWorkspaceTitle().should('contain', canvas1)
                    canvas.getRightSideToolPalette().should('not.exist');
                    //TODO: add a canvas from Class work to rightside workspace
                });
                //TODO add a test for dragging canvas to the left side workspace
                //TODO: add a test for when both views are the same section (Open an intro, put it into workspace, change to 2 up view, drag intro to 2nd space, open intro again, switching back to 1 up view disappears
                //from https://www.pivotaltracker.com/story/show/160826065
                // TODO: 4-up views are not being restored properly.
                it('verify that 2-up and 4-up views are restored properly', function(){
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
                    clueCanvas.getTwoToOneUpViewToggle().should('be.visible');
                    textToolTile.getTextTile().should('exist');
                    graphToolTile.getGraphTile().first().should('exist');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    clueCanvas.openOneUpViewFromTwoUp();
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
            it('will drag an image from left nav to canvas',()=>{
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
        before(()=>{
            rightNav.openRightNavTab('my-work');
            rightNav.openCanvasItem('my-work','investigations','Drawing Wumps')
        })
        it('will delete elements from canvas', function(){
            // //Delete elements in the canvas
            clueCanvas.deleteTile('graph');
            clueCanvas.deleteTile('image');
            clueCanvas.deleteTile('image');
            clueCanvas.deleteTile('draw');
            clueCanvas.deleteTile('table');
            clueCanvas.deleteTile('text');
            clueCanvas.deleteTile('text');
            textToolTile.getTextTile().should('not.exist');
            graphToolTile.getGraphTile().should('not.exist');
            drawToolTile.getDrawTile().should('not.exist');
            imageToolTile.getImageTile().should('not.exist');
            tableToolTile.getTableTile().should('not.exist');
        });
    });
});
//TODO: add tests to verify that publishing different types of documents get published and sorted to the correct section
//(Publish: personal doc=>class work:published personal, investigation=>class work:published, 
// learning logs=>class work: published logs)

