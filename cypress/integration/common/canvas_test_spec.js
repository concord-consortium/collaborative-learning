//Tests for new document, copy, publish are in specific CLUE and dataflow canvas test
// as they verify content that are specific to each project
import Canvas from '../../support/elements/common/Canvas'

let canvas = new Canvas;

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
});

context.skip('test canvas tools', function(){ //need to find new home for this test bec only data docs can be published
    describe('Test header elements UI', function(){
        it('verify publish button', function(){
                //should have create new document
                //should have copy document
                //should have delete document
                //should have edit title button
                //should have publish document
            canvas.getPublishIcon().should('exist'); //Need to ask Avi to change the data-test attribute to just publish-icon
            canvas.getCopyIcon().should('exist');
        });
    })

    describe('Test publish documents', function(){
        it('verify publish and copy button come back up after publish', function(){
            canvas.publishCanvas();
            canvas.getPublishIcon().should('exist');
            canvas.getCopyIcon().should('exist');
        });
    })
})

after(function(){
  cy.clearQAData('all');
});