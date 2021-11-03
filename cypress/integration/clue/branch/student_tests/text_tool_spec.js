import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;


before(function(){
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
});

context('Text tool tile functionalities', function(){
    let title;
    before(()=>{
        clueCanvas.getInvestigationCanvasTitle()
            .then(($canvasTitle)=>{
                title = $canvasTitle.text().trim();
                cy.log('title is: '+title);
            });
    });
    it('adds text tool and types Hello World', function(){
        clueCanvas.addTile('text');
        textToolTile.enterText('Hello World');
        textToolTile.getTextTile().last().should('contain', 'Hello World');
    });
    it('verifies restore of text field content',()=>{
        canvas.createNewExtraDocumentFromFileMenu('text tool test','my-work');
        cy.wait(2000);
        textToolTile.getTextTile().should('not.exist');
        //re-open investigation
        canvas.openDocumentWithTitle('workspaces',title);
        textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
    });
    it('clicks the same text field and allows user to edit text', function(){
        textToolTile.getTextTile().last().focus();
        textToolTile.enterText('Adding more text to see if it gets added. ');
        textToolTile.getTextEditor().last().should('contain','Adding more text to see if it gets added. ');
        textToolTile.enterText('Adding more text to delete');
        textToolTile.getTextEditor().last().should('contain','Adding more text to delete');
        textToolTile.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}');
        textToolTile.getTextTile().last().should('not.contain', 'delete');
    });
    it('delete text tile',()=>{
        clueCanvas.deleteTile('text');
        textToolTile.getTextTile().should('not.exist');
    });
});

after(function(){
  cy.clearQAData('all');
});
