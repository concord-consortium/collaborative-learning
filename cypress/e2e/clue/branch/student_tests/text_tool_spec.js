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
    it('adds text tool and types Hello World', function(){
        clueCanvas.addTile('text');
        textToolTile.enterText('Hello World');
        textToolTile.getTextTile().last().should('contain', 'Hello World');
    });
    it('clicks the same text field and allows user to edit text', function(){
        textToolTile.getTextTile().last().focus();
        textToolTile.enterText('! Adding more text to see if it gets added. ');
        textToolTile.getTextEditor().last().should('contain','! Adding more text to see if it gets added. ');
        textToolTile.enterText('Adding more text to delete');
        textToolTile.getTextEditor().last().should('contain','Adding more text to delete');
        textToolTile.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}...');
        textToolTile.getTextTile().last().should('not.contain', 'delete');
    });
    // FIXME: For some reason that only seems present in these tests, we have to add seemingly
    // superfluous line breaks before applying each text format. If we don't, the descendents
    // we're checking for either don't get added, or get added in a somewhat meaningless way
    // (e.g., `<em></em> This should be italic`). This issue doesn't exist in the browser.
    it('has a toolbar that can be used', function(){
        textToolTile.clickToolbarTool("Bold");
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end}This should be bold.');
        textToolTile.getTextEditor().last().should('have.descendants', 'strong');
        textToolTile.clickToolbarTool("Bold");

        textToolTile.clickToolbarTool("Italic");
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be italic.');
        textToolTile.getTextEditor().last().should('have.descendants', 'em');
        textToolTile.clickToolbarTool("Italic");

        textToolTile.clickToolbarTool("Underline");
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be underlined.');
        textToolTile.getTextEditor().last().should('have.descendants', 'u');
        textToolTile.clickToolbarTool("Underline");

        textToolTile.clickToolbarTool("Subscript");
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be subscript.');
        textToolTile.getTextEditor().last().should('have.descendants', 'sub');
        textToolTile.clickToolbarTool("Subscript");

        textToolTile.clickToolbarTool("Superscript");
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be superscript.');
        textToolTile.getTextEditor().last().should('have.descendants', 'sup');
        textToolTile.clickToolbarTool("Superscript");

        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be in a numbered list');
        textToolTile.clickToolbarTool("Numbered List");
        textToolTile.getTextEditor().last().should('have.descendants', 'ol');

        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be in a bulleted list');
        textToolTile.clickToolbarTool("Bulleted List");
        textToolTile.getTextEditor().last().should('have.descendants', 'ul');
    });
    it('verifies restore of text field content',()=>{
        canvas.createNewExtraDocumentFromFileMenu('text tool test','my-work');
        cy.wait(2000);
        textToolTile.getTextTile().should('not.exist');
        //re-open investigation
        canvas.openDocumentWithTitle('workspaces',title);
        textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
    });
    // FIXME: This test broke post slate upgrade.
    // it('delete text tile',()=>{
    //     clueCanvas.deleteTile('text');
    //     textToolTile.getTextTile().should('not.exist');
    // });
});
