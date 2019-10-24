//Tests for new document, copy, publish are in specific CLUE and dataflow canvas test
// as they verify content that are specific to each project
import Canvas from '../../support/elements/common/Canvas'

let canvas = new Canvas;

context.skip('test canvas tools', function(){
    describe('Test header elements UI', function(){
        it('verify publish button', function(){
                //should have create new document
                //should have copy document
                //should have delete document
                //should have edit title button
                //should have publish document
            canvas.getPublishIcon().should('exist'); //Need to ask Avi to change the data-test attribute to just publish-icon
            canvas.getCopyIcon().should('exist');
            canvas.getDeleteIcon().should('not.exist');//verify if this is true for DF
        });
    })

    describe('Test document creation',()=>{

    })

    describe('Test delete document',()=>{

    })

    describe('Test edit title',()=>{
        
    })

    describe('Test publish documents', function(){
        it('verify publish button', function(){
            canvas.publishCanvas();
            canvas.getPublishIcon().should('exist');
            canvas.getCopyIcon().should('exist');
            canvas.getDeleteIcon().should('not.exist');//verify if this is true for DF
        });
    })
})