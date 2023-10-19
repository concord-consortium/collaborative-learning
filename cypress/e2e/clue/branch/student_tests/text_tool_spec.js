import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;

let copyTitle = 'Text Tile Workspace Copy';


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
    // superfluous spaces and line breaks before applying each text format. If we don't, the
    // elements we're checking for either don't get added, or get added in a somewhat meaningless
    // way (e.g., `<em></em> This should be italic`). This issue doesn't exist in the browser.
    it('has a toolbar that can be used', function(){
        clueCanvas.clickToolbarButton('text', 'bold');
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end}This should be bold.');
        textToolTile.getTextEditor().last().should('have.descendants', 'strong');
        clueCanvas.clickToolbarButton('text', 'bold');

        clueCanvas.clickToolbarButton('text', 'italic');
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be italic.');
        textToolTile.getTextEditor().last().should('have.descendants', 'em');
        clueCanvas.clickToolbarButton('text', 'italic');

        clueCanvas.clickToolbarButton('text', 'underline');
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be underlined.');
        textToolTile.getTextEditor().last().should('have.descendants', 'u');
        clueCanvas.clickToolbarButton('text', 'underline');

        clueCanvas.clickToolbarButton('text', 'subscript');
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be subscript.');
        textToolTile.getTextEditor().last().should('have.descendants', 'sub');
        clueCanvas.clickToolbarButton('text', 'subscript');

        clueCanvas.clickToolbarButton('text', 'superscript');
        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be superscript.');
        textToolTile.getTextEditor().last().should('have.descendants', 'sup');
        clueCanvas.clickToolbarButton('text', 'superscript');

        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be in a numbered list');
        clueCanvas.clickToolbarButton('text', 'list-ol');
        textToolTile.getTextEditor().last().should('have.descendants', 'ol');

        textToolTile.enterText('{end} {enter}');
        textToolTile.enterText('{end} {enter}This should be in a bulleted list');
        clueCanvas.clickToolbarButton('text', 'list-ul');
        textToolTile.getTextEditor().last().should('have.descendants', 'ul');
    });
    it('verifies restore of text field content',()=>{
        canvas.createNewExtraDocumentFromFileMenu('text tool test','my-work');
        cy.wait(2000);
        textToolTile.getTextTile().should('not.exist');
        //re-open investigation
        canvas.openDocumentWithTitle('workspaces',title);
        textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
        textToolTile.getTextEditor().last().should('have.descendants', 'strong');
        textToolTile.getTextEditor().last().should('have.descendants', 'em');
        textToolTile.getTextEditor().last().should('have.descendants', 'u');
        textToolTile.getTextEditor().last().should('have.descendants', 'sub');
        textToolTile.getTextEditor().last().should('have.descendants', 'sup');
        textToolTile.getTextEditor().last().should('have.descendants', 'ol');
        textToolTile.getTextEditor().last().should('have.descendants', 'ul');
    });
    it('verifies restore of text field content in copy document',()=>{
        //copy investigation
        canvas.copyDocument(copyTitle);
        canvas.getPersonalDocTitle().should('contain', copyTitle);
        textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
        textToolTile.getTextEditor().last().should('have.descendants', 'strong');
        textToolTile.getTextEditor().last().should('have.descendants', 'em');
        textToolTile.getTextEditor().last().should('have.descendants', 'u');
        textToolTile.getTextEditor().last().should('have.descendants', 'sub');
        textToolTile.getTextEditor().last().should('have.descendants', 'sup');
        textToolTile.getTextEditor().last().should('have.descendants', 'ol');
        textToolTile.getTextEditor().last().should('have.descendants', 'ul');
        canvas.deleteDocument();
    });
    it('delete text tile',()=>{
        clueCanvas.deleteTile('text');
        textToolTile.getTextTile().should('not.exist');
    });
});
context('Text Tool Tile selection', function () {
    before(function () {
        const queryParams = `${Cypress.config("queryParams")}`;
          cy.clearQAData('all');

          cy.visit(queryParams);
          cy.waitForLoad();
          cy.collapseResourceTabs();
        });

    describe('Test undo redo actions', function () {
    it('selecting the text and verify the tool bar buttons', function(){
        clueCanvas.addTile('text');
        textToolTile.enterText('Hello World');
        textToolTile.getTextTile().last().should('contain', 'Hello World');
        textToolTile.getTextEditor().type('{selectall}');

        //Bold
        clueCanvas.clickToolbarButton('text', 'bold');
        textToolTile.getTextEditor().last().should('have.descendants', 'strong');
        clueCanvas.clickToolbarButton('text', 'bold');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'strong');

        //Italic
        clueCanvas.clickToolbarButton('text', 'italic');
        textToolTile.getTextEditor().last().should('have.descendants', 'em');
        clueCanvas.clickToolbarButton('text', 'italic');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'em');

        //Underline
        clueCanvas.clickToolbarButton('text', 'underline');
        textToolTile.getTextEditor().last().should('have.descendants', 'u');
        clueCanvas.clickToolbarButton('text', 'underline');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'u');

        //Subscript
        clueCanvas.clickToolbarButton('text', 'subscript');
        textToolTile.getTextEditor().last().should('have.descendants', 'sub');
        clueCanvas.clickToolbarButton('text', 'subscript');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'sub');

        //Superscript
        clueCanvas.clickToolbarButton('text', 'superscript');
        textToolTile.getTextEditor().last().should('have.descendants', 'sup');
        clueCanvas.clickToolbarButton('text', 'superscript');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'sup');

        //Numbered List
        clueCanvas.clickToolbarButton('text', 'list-ol');
        textToolTile.getTextEditor().last().should('have.descendants', 'ol');
        clueCanvas.clickToolbarButton('text', 'list-ol');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'ol');

        //Bulleted List
        clueCanvas.clickToolbarButton('text', 'list-ul');
        textToolTile.getTextEditor().last().should('have.descendants', 'ul');
        clueCanvas.clickToolbarButton('text', 'list-ul');
        textToolTile.getTextEditor().last().should('not.have.descendants', 'ul');
    });
  });
});

context('Text Tool Tile Undo Redo', function () {
    before(function () {
      const queryParams = `${Cypress.config("queryParams")}`;
      cy.clearQAData('all');

      cy.visit(queryParams);
      cy.waitForLoad();
      cy.collapseResourceTabs();
    });

    describe('Test undo redo actions', function () {
      it('will undo redo state', function () {
        clueCanvas.getUndoTool().should("have.class", "disabled");
        clueCanvas.getRedoTool().should("have.class", "disabled");
      });
      it('will undo redo text tile creation/deletion', function () {
        // Creation - Undo/Redo
        clueCanvas.addTile('text');
        textToolTile.getTextTile().should("exist");
        clueCanvas.getUndoTool().should("not.have.class", "disabled");
        clueCanvas.getRedoTool().should("have.class", "disabled");
        clueCanvas.getUndoTool().click();
        textToolTile.getTextTile().should("not.exist");
        clueCanvas.getUndoTool().should("have.class", "disabled");
        clueCanvas.getRedoTool().should("not.have.class", "disabled");
        clueCanvas.getRedoTool().click();
        textToolTile.getTextTile().should("exist");
        clueCanvas.getUndoTool().should("not.have.class", "disabled");
        clueCanvas.getRedoTool().should("have.class", "disabled");

        // Deletion - Undo/Redo
        clueCanvas.deleteTile('text');
        textToolTile.getTextTile().should('not.exist');
        clueCanvas.getUndoTool().click();
        textToolTile.getTextTile().should("exist");
        clueCanvas.getRedoTool().click();
        textToolTile.getTextTile().should('not.exist');
      });
      it('will undo redo text field content', function () {
        clueCanvas.addTile('text');
        textToolTile.enterText('Hello World');
        textToolTile.getTextTile().last().should('contain', 'Hello World');
        clueCanvas.getUndoTool().click().click();
        textToolTile.getTextTile().should('have.text', 'Hello Wor');
        textToolTile.getTextTile().should('not.contain', 'World');
        clueCanvas.getRedoTool().click();
        textToolTile.getTextTile().should('have.text', 'Hello Worl');
      });
    });
});
