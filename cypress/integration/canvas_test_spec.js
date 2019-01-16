import LeftNav from '../support/elements/LeftNav'
import Canvas from '../support/elements/Canvas'
import RightNav from '../support/elements/RightNav'
import BottomNav from '../support/elements/BottomNav';
import LearningLog from '../support/elements/LearningLog';

context('Test Canvas', function(){
    let leftNav = new LeftNav;
    let canvas = new Canvas;
    let rightNav = new RightNav;
    let learningLog = new LearningLog;

    //TODO: Tests to add to canvas:
    // 1. reorder tiles
    // 2. drag image to graph and verify image appears behind graph
    // 3. drag image from leftNav to canvas
    // 4. drag image to draw tool and verify image appears behind draw tool elements

    context('test canvas tools', function(){
       describe('test header elements', function(){
           it('verifies header title appears correctly', function(){
                leftNav.openLeftNavTab('Introduction');
                leftNav.openToWorkspace();
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

    context('test the tool palette', function(){
    //This should test the tools in the tool shelf
        //Selection tool currently not doing anything
    //         it('verify the selection tool becomes active when clicked', function() {
    //             cy.get('.single-workspace > .document > .toolbar > .tool.select').click()
    //                 .should('have.class','active');
    //         });

            it('clicks the text tool and types Hello World', function(){

                canvas.addTextTile();
                canvas.enterText('Hello World');
                canvas.getTextTile().last().should('contain', 'Hello World');
            });

            it('clicks the same text field and allows user to edit text', function(){
                canvas.getTextTile().last().focus().click();
                canvas.addText('Adding more text to see if it gets added.');
                canvas.addText('Adding more text to delete');
                canvas.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}');
            });

            it('clicks the graph tool and enters three points', function(){

                canvas.addGraphTile();
                canvas.getGraphTile().last().click();
                canvas.addPointToGraph(100,40);
                canvas.getGraphPointText().last().should('contain', 'A' );
                canvas.addPointToGraph(140,70);
                canvas.getGraphPointText().last().should('contain', 'B' );
                canvas.addPointToGraph(240,170);
                canvas.getGraphPointText().last().should('contain', 'C' );
            });
             it('will test image tool', ()=>{
                 canvas.addImageTile();
                 canvas.getImageTile().should('be.visible');
                 //TODO: Add uploading an image and verify image appears
             });

           it('adds additional text, graph, and image onto canvas and verify scrolling', function(){
               canvas.addTextTile();
               canvas.enterText('second text tool');
               canvas.addGraphTile();
               canvas.getGraphTile();
               canvas.addPointToGraph(40,35);
               canvas.getGraphPointText().last().should('contain', 'A' );
               canvas.addImageTile();
               canvas.addTextTile();
               canvas.enterText('third text tool');
               canvas.addGraphTile();
               canvas.getGraphTile();
               canvas.addPointToGraph(175,55);
               canvas.getGraphPointText().last().should('contain', 'A' );
               canvas.addImageTile();
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
                // let canvas1='Initial';
                // let canvas2='Introduction';
                // //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing
                // leftNav.openLeftNavTab('Initial Challenge');
                // leftNav.openToWorkspace();
                // canvas.getCanvasTitle().should('contain',canvas1);
                // rightNav.openMyWorkTab();
                // rightNav.openMyWorkAreaCanvasItem(canvas1);
                // canvas.getCanvasTitle().should('contain', canvas1);
                // rightNav.closeMyWorkTab();
                // rightNav.openMyWorkTab();
                // rightNav.openMyWorkAreaCanvasItem(canvas2);
                // canvas.getCanvasTitle().should('contain', canvas2);
                //
                // //verify text element with Hello World in showing left from earlier test
                // canvas.getTextTile().first().should('contain', 'Hello World');
                // //Verify the graph has 4 points in it
                // canvas.getGraphTile().first();
                // canvas.getGraphPoints().each(($point, index, $list)=>{}).then(($list)=>{
                //     expect($list).to.have.length(4);
                // });
                //open the my work tab, click a different canvas, verify canvas is shown, open the my work tab, click the introduction canvas, verify intro canvas is showing
                cy.get('#leftNavTab1').click();
                cy.get('.left-nav-panel > .section > .canvas > .document-content > .buttons > button').click();
                cy.get('.single-workspace > .document > .titlebar > .title').should('contain','Initial');
                cy.get('#rightNavTabMy\\ Work').click({force:true});
                cy.get('.list > .list-item[title*="Initial"]').click();
                cy.get('.single-workspace > .document > .titlebar > .title').should('contain', 'Initial');
                cy.get('#rightNavTabMy\\ Work').click({force:true});
                cy.get('.list > .list-item[title*="Introduction"]').click();
                cy.get('.single-workspace > .document > .titlebar > .title').should('contain', 'Introduction');

                //verify text element with Hello World in showing
                canvas.getTextTile().first().should('contain', 'Hello World');
                //Verify the graph has 4 points in it
                canvas.getGraphPointText().each(($point, index, $list)=>{}).then(($list)=>{
                    expect($list).to.have.length(6);
                });
            });
        });

        describe('verify that if user opens same canvas from on left-nav tab, saved canvas opens', function() {
            it('will restore from left nav', ()=>{
                leftNav.openLeftNavTab('What if');
                leftNav.openToWorkspace();
                canvas.getCanvasTitle().should('contain', 'What if');
                leftNav.openLeftNavTab('Introduction');
                leftNav.openToWorkspace();
                canvas.getCanvasTitle().should('contain','Introduction');
                //verify text element with Hello World in showing
                canvas.getTextTile().first().should('contain', 'Hello World');
                //Verify the graph has 4 points in it
                canvas.getGraphTile().first();
                canvas.getGraphPointText().each(($point, index, $list)=>{}).then(($list)=> {
                    expect($list).to.have.length(6);
                });
            });
        });

        describe('verify that if user leaves a canvas in four-up view, restore is also in four up view', function(){
            //TODO need to verify expected behavior when switching from canvas to canvas whether 4-up view should stay up.
            it('verify canvas stays in 4up view when changing canvases', ()=>{
                //Open a canvas
                leftNav.openLeftNavTab('Initial Challenge');
                leftNav.openToWorkspace();
                canvas.getCanvasTitle().should('contain','Initial');
                //switch to 4-up view
                canvas.openFourUpView();
                //open another canvas
                leftNav.openLeftNavTab('What if');
                leftNav.openToWorkspace();
                canvas.getCanvasTitle().should('contain','What if');
                canvas.getFourUpView().should('be.visible');
                //Re-open Initial Challenge canvas from My Work
                rightNav.openMyWorkTab();
                rightNav.openMyWorkAreaCanvasItem("Initial Challenge");
                canvas.getCanvasTitle().should('contain','Initial');
                canvas.getFourUpView().should('be.visible');

                canvas.openOneUpViewFromFourUp(); //clean up
            });
        });
    });

    context('test footer elements', function(){ //moved this to after tool elements have been added to verify that elements still show when in 2-up view
        describe('Test supports area', function(){
            it('verify supports comes up correctly', function(){
                canvas.getSupportList().each(($support, index, $list)=>{
                    let label=$support.text();
                    cy.log('Support is' + $support.text());
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
                //single canvas 4up button and 2 up button is visible
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

            it('verify canvas side by side in right side 2 up view', function(){
                //open the 2up view
                let tab = 'What if';
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
                // cy.get('.right-nav > .expanded-area.expanded > .contents > .my-work > .list > [title="Initial Challenge"]').click();
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
                // cy.get('.right-nav > .expanded-area.expanded > .contents > .my-work > .list > [title="Initial Challenge"]').click();
                learningLog.getRightSideWorkspaceTitle().should('contain','Initial');
                //verify tool palette is not present in the right side workspace
                learningLog.getRightSideToolPalette().should('not.exist');
                //add a canvas to the right side workspace from Class Work
                rightNav.openClassWorkTab();
                rightNav.getAllClassWorkAreaCanvasItems().first().then(($el)=>{
                    let title = $el.text().split('Student')[0];
                    cy.wrap($el).click();
                    learningLog.getRightSideWorkspaceTitle().should('contain',title);
                });
                learningLog.closeLearningLogTab();//close learning log tab because createLearningLog opens it again
                //create second learning log to put up in 2 up view
                learningLog.createLearningLog('slide');
                //add a canvas to the right side workspace from Learning log
                learningLog.openLearningLogCanvasItem('slide');
                learningLog.getRightSideWorkspaceTitle().should('contain','slide');
            });

            //TODO add a test for dragging canvas to the left side workspace

            //TODO: add a test for when both views are the same section (Open an intro, put it into workspace, change to 2 up view, drag intro to 2nd space, open intro again, switching back to 1 up view disappears
            //from https://www.pivotaltracker.com/story/show/160826065
            it('verify that 2-up and 4-up views are restored properly', function(){
                //open a canvas
                leftNav.openToWorkspace('Introduction');
                canvas.getCanvasTitle().should('contain','Introduction');
                //open 4 up view
                canvas.openFourUpView();
                //open another section
                leftNav.openToWorkspace('What if');
                canvas.getCanvasTitle().should('contain','What if');
                //open 2 up view
                canvas.openTwoUpView();
                //go back to the 4up view using the left tab nav
                leftNav.openToWorkspace('Introduction')
                canvas.getCanvasTitle().should('contain','Introduction');
                //verify view comes up in 4 up view without the toggle
                canvas.getFourUpView().should('be.visible');
                canvas.getTwoUpViewToggle().should('be.visible');
                canvas.getRightSideWorkspace().should('not.be.visible');
                canvas.openOneUpViewFromFourUp(); //clean up
            });
        });
        });
    });

    context('Dragging elements from different locations to canvas', function(){
       describe('Drag element from left nav', function(){
           it('will drag an image from left nav to canvas',()=>{
               leftNav.openToWorkspace('Extra Workspace');
               cy.wait(1000);
               leftNav.openLeftNavTab('Introduction');
               leftNav.getLeftNavExpandedSpace().find('.image-tool').first()
                   .trigger('mousedown')
                   .trigger('dragstart');
               // canvas.canvas()
               cy.get('.app')
                   .trigger('mousemove', {pageX:725, pageY:450, force:true})
                   .trigger('mouseup', {force:true});

               cy.get('.document-content').first().should('exist')
                   .trigger('drag', 450, 350, {force:true})
                   .trigger('drop', {force:true});

               leftNav.closeLeftNavTab('Introduction')
           })
       });
        describe('Drag element from one canvas to another in 4-up view', function(){
            it('will drag an image from canvas to canvas',()=>{
                //setup group
                //open Extra Workspace
                //add tiles to last student
                //add graph points
                //share document
                //Go to first student
                //Open Extra Workspace
                //open 4-up view
                //verify last student document exists
                //drag a tile from last student document to own document.
            })
        })
    });

    context('delete elements from canvas', function(){
        it('will delete elements from canvas', function(){
            // //Delete elements in the canvas
            leftNav.openToWorkspace('Introduction');
            canvas.deleteTile('text');
            canvas.deleteTile('graph');
            canvas.deleteTile('image');
            canvas.deleteTile('text');
            canvas.deleteTile('graph');
            canvas.deleteTile('image');
            canvas.deleteTile('text');
            canvas.deleteTile('graph');
            canvas.deleteTile('image');
        });

        it('will try to delete elements from other canvases in 4 up view', function(){
            //TODO
        })
    });

});