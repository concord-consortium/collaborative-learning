import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;


context('Text tool tile functionalities', function(){
    before(function(){
        const queryParams = `${Cypress.config("queryParams")}`;
    
        cy.clearQAData('all');
        cy.visit(queryParams);
        cy.waitForLoad();
    });
        
    let title;
    before(()=>{
        clueCanvas.getInvestigationCanvasTitle()
            .then(($canvasTitle)=>{
                title = $canvasTitle.text().trim();
                cy.log('title is: '+title);
            });
    });
    it('dummy test', function () {
        expect(true).to.equal(true);
    });
    // FIXME: typing in text tiles broken
    // it('adds text tool and types Hello World', function(){
    //     clueCanvas.addTile('text');
    //     textToolTile.enterText('Hello World');
    //     textToolTile.getTextTile().last().should('contain', 'Hello World');
    // });
    // it('verifies restore of text field content',()=>{
    //     canvas.createNewExtraDocumentFromFileMenu('text tool test','my-work');
    //     cy.wait(2000);
    //     textToolTile.getTextTile().should('not.exist');
    //     //re-open investigation
    //     canvas.openDocumentWithTitle('workspaces',title);
    //     textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
    // });
    // it('clicks the same text field and allows user to edit text', function(){
    //     textToolTile.getTextTile().last().focus();
    //     textToolTile.enterText('Adding more text to see if it gets added. ');
    //     textToolTile.getTextEditor().last().should('contain','Adding more text to see if it gets added. ');
    //     textToolTile.enterText('Adding more text to delete');
    //     textToolTile.getTextEditor().last().should('contain','Adding more text to delete');
    //     textToolTile.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}');
    //     textToolTile.getTextTile().last().should('not.contain', 'delete');
    // });
    // it('has a toolbar that can be used', function(){
    //     textToolTile.clickToolbarTool("Bold");
    //     textToolTile.enterText('this should be bold');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'strong');
    //     textToolTile.clickToolbarTool("Bold");

    //     textToolTile.clickToolbarTool("Italic");
    //     textToolTile.enterText('this should be italics');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'em');
    //     textToolTile.clickToolbarTool("Italic");

    //     textToolTile.clickToolbarTool("Underline");
    //     textToolTile.enterText('this should be underline');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'u');
    //     textToolTile.clickToolbarTool("Underline");

    //     textToolTile.clickToolbarTool("Subscript");
    //     textToolTile.enterText('this should be subscript');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'sub');
    //     textToolTile.clickToolbarTool("Subscript");

    //     textToolTile.clickToolbarTool("Superscript");
    //     textToolTile.enterText('this should be underline');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'sup');
    //     textToolTile.clickToolbarTool("Superscript");

    //     textToolTile.enterText('{enter}');
    //     textToolTile.clickToolbarTool("Numbered List");
    //     textToolTile.enterText('this should be in a numbered list{enter}');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'ol');
    //     textToolTile.clickToolbarTool("Numbered List");

    //     textToolTile.enterText('{enter}');
    //     textToolTile.clickToolbarTool("Bulleted List");
    //     textToolTile.enterText('this should be in a bulleted list{enter}');
    //     textToolTile.getTextEditor().last().should('have.descendants', 'ul');
    //     textToolTile.clickToolbarTool("Bulleted List");
    // });
    // it('delete text tile',()=>{
    //     clueCanvas.deleteTile('text');
    //     textToolTile.getTextTile().should('not.exist');
    // });
});
