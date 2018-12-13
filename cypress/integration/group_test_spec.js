import LeftNav from './elements/LeftNav'
import Canvas from './elements/Canvas'

const leftNav = new LeftNav;
const canvas = new Canvas;
const baseUrl = `${Cypress.config("baseUrl")}`;

context('Test group functionalities', function(){
    let qaClass = 10,
        qaOffering = 10,
        qaGroup = 10,
        problem = 2.3,
        studentArr=[15,16,17,18];
    context('test the views', function(){
        describe('set-up for 4-up view tests', function(){
            it('will enter text into the 1-up canvas', function(){
                cy.setupGroup(studentArr, qaGroup)
                // // Manually create students to go into Group
                //
                //     let i=0;
                //
                // for (i=0;i<studentArr.length;i++) {
                //     cy.wait(5000);
                //     cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr[i]+'&fakeOffering='+qaOffering+'&problem=2.3');
                //     leftNav.openToWorkspace('Now What');
                //     cy.get('.single-workspace > .document > .toolbar > .tool.text').click({force: true});
                //     cy.get('.canvas-area > .canvas > .document-content > .tile-row > .tool-tile > .text-tool').last().type('This is to test the 4-up view of S'+studentArr[i]);
                //     cy.get('.canvas-area > .canvas > .document-content > .tile-row > .tool-tile > .text-tool').last().should('contain', '4-up').and('contain','S'+studentArr[i]);
                //     cy.get('.single-workspace > .document > .titlebar > .actions > .icon-share').click();//all students will share their canvas
                //     cy.wait(1000);
                // }
                // //verify Group num and there are 4 students in the group
                // cy.get('.app > .group-view > .header > .group > .name').should('contain','Group '+qaGroup);
                // cy.get('.app > .group-view > .header > .group > .members > .member').each(($member,index, $list)=>{
                //     expect(['S15','S16','S17','S18']).to.include($member.text());
                // });
            });
            it('verify 4-up view comes up correctly with students', function(){
                canvas.openFourUpView();
                canvas.getFourToOneUpViewToggle().should('be.visible');
                canvas.getNorthEastCanvas().should('be.visible').and('contain','S'+studentArr[0]);
                canvas.getSouthEastCanvas().should('be.visible').and('contain','S'+studentArr[1]);
                canvas.getSouthWestCanvas().should('be.visible').and('contain','S'+studentArr[2]);
                canvas.getNorthWestCanvas().should('be.visible').and('contain','S'+studentArr[3]);
            });

        });
        describe('test the 4-up view', function(){
            // it("will move horizontal splitter vertically and verify canvas size change", function () {
            //     cy.get('.canvas-area > .four-up > .horizontal.splitter').trigger('mousedown',{which:1}, {force:true}).trigger('mousemove',{pageX:243, pageY: 175}, {force:true}).trigger('mouseup',{force:true});
            //     cy.get('.canvas-area > .canvas-container.north-west').should('have.css','height').and('less.than', 243);
            //     cy.get('.canvas-area > .canvas-container.south-east').should('have.css','height').and('greater.than', 243);
            //
            // });
            // it('will move vertical splitter horizantally and verify canvas size change', function(){
            //     cy.log('need to write this test');
            //     expect(4).to.equal(3);
            // });
            //TODO: drag and drop of center point to change 4up view canvas sizes
            it('will move the center handle horizontally and vertically and verify canvas size change', function (){
                // canvas.getCenterSeparator()
                //     .trigger('dragstart',{force:true})
                //     .trigger('drag',243, 175, {force:true})
                //     .trigger('dragend',{force:true});

            });
            it('will verify editing own canvas is still possible in 4-up view', function(){
                canvas.addTextTile();
                canvas.getTextTile().last().type('Hello World!');
                canvas.getTextTile().last().should('contain', 'Hello World');
                canvas.addGraphTile();
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me > .geometry-tool').last().click();
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me  > .geometry-tool > .JXGtext').last().should('contain', 'A' );
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me > .geometry-tool').last().click(140,70, {force:true});
                // cy.get('.canvas-container.north-west > .canvas-scaler > .canvas > .document-content > .tile-row> .tool-tile > .geometry-size-me > .geometry-tool > .JXGtext').last().should('contain', 'B' );
            });

            it('will verify editing is not allowed in other group members\' canvas', function(){
                cy.get('.canvas-container.north-east > .canvas-scaler > .canvas > .document-content > .tile-row >.tool-tile > .text-tool').last().should('not.contain', 'Hello World');
                cy.get('.canvas-container.south-west > .canvas-scaler > .canvas > .document-content > .tile-row >.tool-tile > .text-tool').last().should('not.contain', 'Hello World');
                cy.get('.canvas-container.south-east > .canvas-scaler > .canvas > .document-content > .tile-row >.tool-tile > .text-tool').last().should('not.contain', 'Hello World');
                canvas.openOneUpViewFromFourUp(); //clean up

            });

            //TODO: have to figure out drag and drop
            it('will copy text from one canvas to own canvas', function(){
                cy.log('need to write this test');
            });
        });

        describe('test sharing and unsharing canvases', function(){
            it('will share canvas and verify canvas is visible in groupmates 4-up view', function(){
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

        describe('test copy and paste from another canvas to another canvas', function(){
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