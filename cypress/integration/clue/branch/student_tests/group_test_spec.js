import LeftNav from '../../../../support/elements/clue/LeftNav'
import Canvas from '../../../../support/elements/common/Canvas'
import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import TextToolTile from '../../../../support/elements/clue/TextToolTile'
import ClueHeader from '../../../../support/elements/clue/cHeader';

const leftNav = new LeftNav;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const clueHeader = new ClueHeader;

const baseUrl = `${Cypress.config("baseUrl")}`;

context('Test group functionalities', function(){
    let qaClass = 10,
        qaGroup = 10,
        problem = 3.3,
        studentArr=[15,16,17,18];
    context('test the views', function(){
        describe('set-up for 4-up view tests', function(){
            it('will set up groups', function(){
                cy.setupGroup(studentArr, qaGroup)
            });
            it.skip('will add content to each student canvas', function(){
                let i=0;
                for (i=0; i<studentArr.length; i++){
                    cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr[i]+'&problem='+problem);
                    clueCanvas.addTile('text');
                    textToolTile.enterText('This is to test the 4-up view of S'+studentArr[i]);
                    textToolTile.getTextTile().last().should('contain', '4-up').and('contain','S'+studentArr[i]);
                    clueCanvas.addTile('geometry');
                    clueCanvas.addTile('table');
                    clueCanvas.addTile('draw');
                    clueCanvas.addImageTile('image');
                    clueCanvas.shareCanvas();//all students will share their canvas
                    // cy.wait(1000);
                }
            });
            it('verify 4-up view comes up correctly with students', function(){
                clueCanvas.openFourUpView();
                clueCanvas.getFourToOneUpViewToggle().should('be.visible');
                clueCanvas.getNorthEastCanvas().should('be.visible').and('contain','S'+studentArr[0]);
                clueCanvas.getSouthEastCanvas().should('be.visible').and('contain','S'+studentArr[1]);
                clueCanvas.getSouthWestCanvas().should('be.visible').and('contain','S'+studentArr[2]);
                clueCanvas.getNorthWestCanvas().should('be.visible').and('contain','S'+studentArr[3]);
            });
        });
        describe('test the 4-up view', function(){
            // TODO: CSS element visibility error, {force: true}
            it.skip("will move horizontal splitter vertically and verify canvas size change", function () {
                cy.get('.canvas-area > .four-up > .horizontal.splitter').trigger('mousedown',{which:1}, {force:true}).trigger('mousemove',{pageX:243, pageY: 175}, {force:true}).trigger('mouseup',{force:true});
                cy.get('.canvas-area > .canvas-container.north-west').should('have.css','height').and('less.than', 243);
                cy.get('.canvas-area > .canvas-container.south-east').should('have.css','height').and('greater.than', 243);
            });
            // TODO: Write this test
            it.skip('will move vertical splitter horizantally and verify canvas size change', function(){
                cy.log('need to write this test');
            });
            // TODO: drag and drop of center point to change 4up view canvas sizes
            it('will move the center handle horizontally and vertically and verify canvas size change', function (){
                clueCanvas.getCenterSeparator()
                    .trigger('dragstart',{force:true})
                    .trigger('drag',243, 175, {force:true})
                    .trigger('dragend',{force:true});
            });
            it('will verify editing own canvas is still possible in 4-up view', function(){
                clueCanvas.addTile('text');
                textToolTile.getTextTile().first().type('Hello World!');
                textToolTile.getTextTile().first().should('contain', 'Hello World');
                clueCanvas.addTile('geometry');
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me > .geometry-tool').last().click();
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me  > .geometry-tool > .JXGtext').last().should('contain', 'A' );
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me > .geometry-tool').last().click(140,70, {force:true});
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me > .geometry-tool > .JXGtext').last().should('contain', 'B' );
            });
            // TODO: Never found elements
            it.skip('will verify editing is not allowed in other group members\' canvas', function(){
                cy.get('.canvas-container.north-east > .canvas-scaler > .canvas > .document-content > .tile-row >.tool-tile > .text-tool').last().should('not.contain', 'Hello World');
                cy.get('.canvas-container.south-west > .canvas-scaler > .canvas > .document-content > .tile-row >.tool-tile > .text-tool').last().should('not.contain', 'Hello World');
                cy.get('.canvas-container.south-east > .canvas-scaler > .canvas > .document-content > .tile-row >.tool-tile > .text-tool').last().should('not.contain', 'Hello World');
            });
            it.skip('will try to delete elements from other canvases in 4 up view', function(){
                //TODO
                cy.log('need to write this test');
            })

            //TODO: have to figure out drag and drop
            it.skip('will copy text from one canvas to own canvas', function(){
                cy.log('need to write this test');
            });
            after(()=>{
                clueCanvas.unshareCanvas();
                clueCanvas.openOneUpViewFromFourUp(); //clean up
            })
        });

        // TODO: Need to write tests
        describe('test sharing and unsharing canvases', function(){
            it('verify share icon toggles correctly',()=>{
                clueCanvas.getShareButton().should('have.class', 'public');
                clueCanvas.shareCanvas();
                clueCanvas.getShareButton().should('have.class', 'private');
                clueCanvas.unshareCanvas();
                clueCanvas.getShareButton().should('have.class', 'public');
            })
            it('will verify canvas is visible in groupmates 4-up view', function(){ //canvas is shared during set up
                cy.log('need to write this test');
            });
            it('will unshare canvas and verify canvas is not visible in groupmates 4-up view', function(){
                cy.log('need to write this test');
            });
            it('restore a 4-up canvas where a groupmate has shared a canvas while it was not open', function(){
                cy.log('need to write this test');
            });
            it('restore a 4-up canvas where a groupmate has unshared a canvas while it was not open', function(){
                cy.log('need to write this test');
            });
            it('will open a new 4-up canvas with shared canvas from other students updated', function(){
                cy.log('need to write this test');
            });
        });
        describe.skip('test copy and paste from another canvas to another canvas', function(){
            it('verify that student can copy text field from another student canvas into own', function(){
                cy.log('need to write this test');
            });
            it('verify that student can copy graph field from another student canvas into own', function(){
                cy.log('need to write this test');
            });
            it('verify that student cannot copy text field from own canvas into another student canvas', function(){
                cy.log('need to write this test');
            });
            it('verify that student cannot copy graph field from own canvas into another student', function(){
                cy.log('need to write this test');
            });
            it('verify student cannot copy text and graph field from another student to another student', function(){
                cy.log('need to write this test');
            });
        });
    });
});

after(function(){
    cy.clearQAData('all');
  });