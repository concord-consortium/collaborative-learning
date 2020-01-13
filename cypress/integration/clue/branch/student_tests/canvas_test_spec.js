import LeftNav from '../../../../support/elements/clue/LeftNav'
import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import RightNav from '../../../../support/elements/common/RightNav'
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile'
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile'
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile'
import TextToolTile from '../../../../support/elements/clue/TextToolTile'
import TableToolTile from '../../../../support/elements/clue/TableToolTile'

let leftNav = new LeftNav;
let canvas = new Canvas;
let clueCanvas = new ClueCanvas;
let rightNav = new RightNav;
let graphToolTile = new GraphToolTile;
let imageToolTile = new ImageToolTile;
let drawToolTile = new DrawToolTile;
let textToolTile = new TextToolTile;
let tableToolTile = new TableToolTile;

let studentWorkspace = 'My Student Test Workspace';

context('Test Canvas', function(){
    //TODO: Tests to add to canvas:
    // 1. reorder 
    // 3. drag image from leftNav to canvas
    // 5. drag a tool from tool bar to canvas
    before(function(){
            const baseUrl = `${Cypress.config("baseUrl")}`;
            const queryParams = `${Cypress.config("queryParams")}`;
        
            cy.visit(baseUrl+queryParams);
            cy.waitForSpinner();
        clueCanvas.getInvestigationCanvasTitle().text().as('title');
    })

    context('test canvas tools', function(){
        describe('test header elements', function(){
            it('verify investigation header UI',()=>{ // element functionality are tested in common
                canvas.getNewDocumentIcon().should('be.visible');
                canvas.getCopyIcon().should('be.visible');
                canvas.getDeleteIcon().should('not.exist');
                canvas.getEditTitleIcon().should('not.exist');
                canvas.getPublishIcon().should('be.visible');
                clueCanvas.getShareButton().should('be.visible');
                clueCanvas.getFourUpViewToggle().should('be.visible');
                clueCanvas.openFourUpView();
                clueCanvas.getShareButton().should('be.visible')//should have share in 4 up
                clueCanvas.openOneUpViewFromFourUp();
            })
            it('verify personal workspace header UI',()=>{ //other header elements are tested in common
               canvas.createNewExtraDocument(studentWorkspace);
               canvas.getNewDocumentIcon().should('be.visible');
               canvas.getCopyIcon().should('be.visible');
               canvas.getDeleteIcon().should('be.visible');
               canvas.getEditTitleIcon().should('be.visible');
               canvas.getPersonalPublishIcon().should('be.visible');
               clueCanvas.getShareButton().should('not.exist');
               clueCanvas.getFourUpViewToggle().should('not.exist');
            })
        })
        describe('Test personal workspace canvas',function(){
            it('verify personal workspace does not have section headers', function(){
                clueCanvas.getRowSectionHeader().should('not.exist');
            })
            it('verify tool tiles',function(){ //to be used for save and restore test
                clueCanvas.addTile('geometry');
                clueCanvas.addTile('table');
                clueCanvas.addTile('text');
                textToolTile.addText('this is '+ studentWorkspace);
            })
            it('verify copy of personal workspace', function(){
                let copyTitle = 'Personal Workspace Copy'
                canvas.copyExtraDocument(copyTitle);
                canvas.getPersonalDocTitle().should('contain',copyTitle);
                graphToolTile.getGraphTile().should('be.visible');
                tableToolTile.getTableTile().should('be.visible');
                textToolTile.getTextTile().should('be.visible').and('contain',studentWorkspace);
            })
            it('verify rename of workspace title', function(){
                let renameTitle = "Renamed Title";
                canvas.editTitle(renameTitle);
                canvas.getPersonalDocTitle().should("contain",renameTitle);
                rightNav.openRightNavTab('my-work')
                rightNav.openSection('my-work','workspaces');
                rightNav.getCanvasItemTitle('my-work','workspaces').should('contain',renameTitle);
            })
            it('verify create new document', function(){
                let newDocTitle = 'New User Doc To Publish';
                canvas.createNewExtraDocument(newDocTitle);
                canvas.getPersonalDocTitle().should('contain',newDocTitle);
                graphToolTile.getGraphTile().should('not.exist');
                tableToolTile.getTableTile().should('not.exist');
                textToolTile.getTextTile().should('not.exist')
            })
            it('verify publish document', function(){
                let newDocTitle = 'New User Doc To Publish';
                canvas.publishPersonalCanvas();
                rightNav.openRightNavTab('class-work')
                rightNav.openSection('class-work','personal');
                rightNav.getCanvasItemTitle('class-work','personal').should('contain',newDocTitle)
            })
        })
        
        describe('Test section heaaders',function(){    
            let headers=['IN','IC','WI','NW'];
            let headerTitles=["Introduction", "Initial Challenge", "What If...?","Now What Do You Know?"]
            before(function(){
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work','investigations')
                rightNav.openCanvasItem('my-work','investigations',this.title)
            })
            it('verified initial canvas load has sections',function(){
                headers.forEach(function(header){
                    clueCanvas.getSectionHeader(header).should('exist');
                })
            })
            it('verifies section header has initials and titles',function(){
                let i=0
                for (i=0;i<headers.length;i++){
                    clueCanvas.getSectionHeader(headers[i]).find('.initials').should('contain', headers[i])
                    clueCanvas.getSectionHeader(headers[i]).find('.title').should('contain', headerTitles[i])
                }
            })
            it('verifies section headers are not deletable',function(){
                clueCanvas.getRowSectionHeader().each(function($header, index, $header_list){
                    cy.wrap($header).click({force:true});
                    clueCanvas.getDeleteTool().click();
                    expect($header).to.exist;
                })
            })
            it('verifies a placeholder tile for every section header', function(){
                clueCanvas.getRowSectionHeader().each(function($header, index, $header_list){
                    let numHeaders=$header_list.length;
                    clueCanvas.getPlaceHolder().should('have.length',numHeaders)
                })
            })
            it('verifies work area placeholder is not deletable',function(){
                clueCanvas.getPlaceHolder().each(function($holder, index, $holder_list){
                    let numHolders = $holder_list.length;
                    clueCanvas.getPlaceHolder().first().should('exist');
                    clueCanvas.getPlaceHolder().first().click({force:true});
                    clueCanvas.getDeleteTool().click();
                    clueCanvas.getPlaceHolder().should('have.length',numHolders);
                })        
            })
            it.skip('verifies work area placeholder is not draggable', function(){
                //TODO: not sure how to test this yet
            })
            it('verifies publish of investigation',function(){
                canvas.publishCanvas()
                rightNav.openRightNavTab('class-work');
                rightNav.openSection('class-work','published');
                rightNav.getCanvasItemTitle('class-work','published').should('contain',this.title)
            })
            it('verifies copy of investigation',function(){
                let copyTitle = 'Investigation Copy'
                canvas.copyDocument(copyTitle);
                canvas.getPersonalDocTitle().should('contain', copyTitle);
                rightNav.openRightNavTab('my-work');
                rightNav.openSection('my-work','workspaces');
                rightNav.getCanvasItemTitle('my-work','workspaces').should('contain',copyTitle)
            })
        })
        describe('Test 4up view',function(){
            before(function(){
                rightNav.openCanvasItem('my-work','investigations',this.title);
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
                clueCanvas.getShareButton().find('.button-icon').should('have.class','private')
                clueCanvas.shareCanvas();
                clueCanvas.getShareButton().should('be.visible');
                clueCanvas.getShareButton().find('.button-icon').should('have.class','public')
                clueCanvas.unshareCanvas();
                clueCanvas.getShareButton().should('be.visible');
                clueCanvas.getShareButton().find('.button-icon').should('have.class','private')
            });
        }) ;

        describe('Test 4-up view', function(){
            it('will drag the center point and verify that canvases resize', function(){
                clueCanvas.openFourUpView();
                cy.get('.four-up .center')
                    .trigger('dragstart')
                    .trigger('mousemove',100, 250, {force:true})
                    .trigger('drop');
                clueCanvas.openOneUpViewFromFourUp(); //clean up
            });
        });

        describe('Test the tool palette', function(){//This should test the tools in the tool shelf
            // Tool palettes for Graph, Image, Draw,and Table are tested in respective tool spec test
            //Selection tool is tested as a functionality of graph tool tiles

            it('adds text tool', function(){
                clueCanvas.addTile('text');
                textToolTile.getTextTile().should('exist');
                textToolTile.addText('This is the Investigation '+this.title)
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
                graphToolTile.getGraphTile().scrollIntoView();
                textToolTile.getTextTile().first().scrollIntoView();
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

        describe('save and restore of tool tiles', function(){
            describe.skip('verify that tool tiles is saved from various locations', function(){
                it('will restore from My Work tab', function() {
                    //Open personal workspace
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','workspaces',studentWorkspace)
                    canvas.getPersonalDocTitle().should('contain',studentWorkspace)
                    graphToolTile.getGraphTile().should('be.visible');
                    tableToolTile.getTableTile().should('be.visible');
                    textToolTile.getTextTile().should('be.visible').and('contain',studentWorkspace)
                    
                    //Open Investigation
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','investigations',this.title);
                    clueCanvas.getInvestigationCanvasTitle().should('contain', this.title)
                    textToolTile.getTextTile().should('be.visible').and('contain', this.title);
                    graphToolTile.getGraphTile().should('be.visible');
                    drawToolTile.getDrawTile().should('exist');
                    imageToolTile.getImageTile().should('exist');
                    tableToolTile.getTableTile().should('exist');
                    clueCanvas.openFourUpView()//for later test on restore of 4up view
                    clueCanvas.getNorthWestCanvas().should('be.visible')
                });
            });

            describe.skip('verify that if user leaves a canvas in four-up view, restore is also in four up view', function(){
                it('verify restore in 4 up view',function(){
                    //Open Personal Workspace
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','workspaces',studentWorkspace)
                    rightNav.closeRightNavTab('my-work')
                    canvas.getPersonalDocTitle().should('contain',studentWorkspace)
                
                    //Open Investigation should be in 4up view
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work','investigations',this.title);
                    rightNav.closeRightNavTab('my-work');
                    clueCanvas.getInvestigationCanvasTitle().should('contain',this.title)
                    clueCanvas.getNorthWestCanvas().should('be.visible')
                })
            });
        });

        context('test footer elements', function(){
            describe('Test the 2-up view', function(){
                it.skip('verify 2 up button, and correct corresponding view comes up', function(){
                    clueCanvas.getTwoUpViewToggle().should('be.visible');
                    clueCanvas.openTwoUpView();
                    clueCanvas.openOneUpViewFromTwoUp();
                    clueCanvas.getRightSideWorkspace().should('not.be.visible');
                    clueCanvas.getLeftSideWorkspace().should('not.be.visible');
                    canvas.getSingleCanvas().should('be.visible');
                });

                it.skip('verify 2-up view is visible when canvas is in 4-up view', function(){
                    //single canvas 4up button and 2up button is visible
                    clueCanvas.getNorthEastCanvas().should('be.visible');
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
                it('verify right side canvas in 2 up view', function(){
                    //open the 2up view
                    clueCanvas.openTwoUpView();
                    clueCanvas.getRightSideWorkspace().should('be.visible');
                    //verify tool palette is present in left side workspace
                    clueCanvas.getLeftSideToolPalette().should('be.visible');
                    //add a canvas to the rightside workspace from My Work
                    rightNav.openRightNavTab('my-work');
                    rightNav.openCanvasItem('my-work', 'workspaces', studentWorkspace);
                    clueCanvas.getRightSideWorkspaceTitle().should('contain',studentWorkspace)
                    //verify tool palette is not present in the rightside workspace
                    clueCanvas.getRightSideToolPalette().should('not.exist');
                    //Verify header elements do not appear in right side canvas 
                    //by checking how many of the icons exist in the DOM
                    canvas.getNewDocumentIcon().should('have.length',1);
                    canvas.getCopyIcon().should('have.length', 1);
                    canvas.getPublishIcon().should('have.length',1);
                    clueCanvas.getShareButton().should('have.length',1)
                });
                describe('header actions in 2up view',function(){
                    it('verify copy of workspace',function(){
                        let title = 'copy of 1.2'
                        canvas.copyDocument(title);
                        clueCanvas.getLeftSidePersonalDocTitle().should('contain',title)
                    });
                    it('verify new workspace', function(){
                        let title = 'New in 2up'
                        canvas.createNewExtraDocument(title);
                        clueCanvas.getLeftSidePersonalDocTitle().should('contain',title)
                    });
                    it('verify publishing', function(){//{https://www.pivotaltracker.com/story/show/169159799}
                        //TODO
                    });
                    it('verify share',function(){
                        //TODO
                    });
                })
                //TODO: add a test for when both views are the same section (Open an intro, put it into workspace, change to 2 up view, drag intro to 2nd space, open intro again, switching back to 1 up view disappears
                //from https://www.pivotaltracker.com/story/show/160826065
            });
        });
    });

    context('Dragging elements from different locations to canvas', function(){
        describe('Drag element from left nav', function(){
            const dataTransfer = new DataTransfer;
            // TODO: Unable to get elements
            it.skip('will drag an image from left nav to canvas',()=>{
                leftNav.openToWorkspace('Extra Workspace');
                // cy.wait(1000);
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
       //TODO add a test for dragging rightside canvas to the left side workspace

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
    context('delete workspaces',function(){
        it('verify delete of personal workspace', function(){
            //TODO
        })
        it('verify delete of copy of personal workspace', function(){
            //TODO 
        })
        it('verify that original personal workspace is not deleted when copy is deleted', function(){
            //TODO
        })
        it('verify that published personal workspace', function(){
            //TODO
        })
        it('verify delete of Learning Log workspace', function(){
            //TODO
        })
        it('verify delete of starred personal workspace', function(){
            //TODO: should also delete document from Starred section
        })
        it('verify investigation workspace cannot be deleted', function(){
            //TODO
        })
    })
});

after(function(){
  cy.clearQAData('all');
});