import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
let title = "QA 1.1 Solving a Mystery with Proportional Reasoning";
let copyTitle = 'Text Tile Workspace Copy';

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Text tool tile functionalities', function () {
  it('add, select, delete and edit text', function () {
    beforeTest();

    cy.log('adds text tool and types Hello World');
    clueCanvas.addTile('text');
    textToolTile.verifyTextTileIsEditable();
    textToolTile.enterText('Hello World');
    textToolTile.getTextTile().last().should('contain', 'Hello World');

    cy.log('clicks the same text field and allows user to edit text');
    textToolTile.getTextTile().last().focus();
    textToolTile.enterText('! Adding more text to see if it gets added. ');
    textToolTile.getTextEditor().last().should('contain', '! Adding more text to see if it gets added. ');
    textToolTile.enterText('Adding more text to delete');
    textToolTile.getTextEditor().last().should('contain', 'Adding more text to delete');
    textToolTile.deleteText('{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}...');
    textToolTile.getTextTile().last().should('not.contain', 'delete');

    // FIXME: For some reason that only seems present in these tests, we have to add seemingly
    // superfluous spaces and line breaks before applying each text format. If we don't, the
    // elements we're checking for either don't get added, or get added in a somewhat meaningless
    // way (e.g., `<em></em> This should be italic`). This issue doesn't exist in the browser.
    cy.log('has a toolbar that can be used');
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

    // Text tile restore upon page reload
    cy.wait(1000);
    cy.reload();
    cy.waitForLoad();
    textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
    textToolTile.getTextEditor().last().should('have.descendants', 'strong');
    textToolTile.getTextEditor().last().should('have.descendants', 'em');
    textToolTile.getTextEditor().last().should('have.descendants', 'u');
    textToolTile.getTextEditor().last().should('have.descendants', 'sub');
    textToolTile.getTextEditor().last().should('have.descendants', 'sup');
    textToolTile.getTextEditor().last().should('have.descendants', 'ol');
    textToolTile.getTextEditor().last().should('have.descendants', 'ul');

    cy.log('verifies restore of text field content');
    canvas.createNewExtraDocumentFromFileMenu('text tool test', 'my-work');
    cy.wait(2000);
    textToolTile.getTextTile().should('not.exist');
    //re-open investigation
    canvas.openDocumentWithTitle('workspaces', title);
    textToolTile.getTextTile().last().should('exist').and('contain', 'Hello World');
    textToolTile.getTextEditor().last().should('have.descendants', 'strong');
    textToolTile.getTextEditor().last().should('have.descendants', 'em');
    textToolTile.getTextEditor().last().should('have.descendants', 'u');
    textToolTile.getTextEditor().last().should('have.descendants', 'sub');
    textToolTile.getTextEditor().last().should('have.descendants', 'sup');
    textToolTile.getTextEditor().last().should('have.descendants', 'ol');
    textToolTile.getTextEditor().last().should('have.descendants', 'ul');

    cy.log('verifies restore of text field content in copy document');
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

    cy.log('delete text tile');
    clueCanvas.deleteTile('text');
    textToolTile.getTextTile().should('not.exist');
  });

  it('Text Tool Tile selection', function () {
    beforeTest();

    cy.log('selecting the text and verify the tool bar buttons');
    clueCanvas.addTile('text');
    textToolTile.verifyTextTileIsEditable();
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

  it('Text Tool Undo/Redo', function () {
    beforeTest();

    cy.log('will undo redo state');
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");

    cy.log('will undo redo text tile creation/deletion');
    // Creation - Undo/Redo
    clueCanvas.addTile('text');
    textToolTile.verifyTextTileIsEditable();
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

    cy.log('will undo redo text field content');
    clueCanvas.addTile('text');
    textToolTile.verifyTextTileIsEditable();
    textToolTile.enterText('Hello World');
    textToolTile.getTextTile().last().should('contain', 'Hello World');
    clueCanvas.getUndoTool().click().click();
    textToolTile.getTextTile().should('have.text', 'Hello Wor');
    textToolTile.getTextTile().should('not.contain', 'World');
    clueCanvas.getRedoTool().click();
    textToolTile.getTextTile().should('have.text', 'Hello Worl');

    // Access the text tile element
    textToolTile.getTextTile().should("exist");

    // should undo and redo formatted text changes

    // Undo/Redo checks for bulleted text
    cy.get('.toolbar-button.list-ul').click();
    textToolTile.getTextEditor().last().should('have.descendants', 'ul');
    clueCanvas.getUndoTool().click().click().click();
    textToolTile.getTextTile().should('not.have.descendants', 'ul');
    clueCanvas.getRedoTool().click().click().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'ul');

    //Undo/Redo checks for Numbered List
    clueCanvas.clickToolbarButton('text', 'list-ol');
    textToolTile.getTextEditor().last().should('have.descendants', 'ol');
    clueCanvas.getUndoTool().click().click().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'ol');
    clueCanvas.getRedoTool().click().click().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'ol');
    clueCanvas.getUndoTool().click().click().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'ol');


    // Undo/Redo checks for Bold formatting
    textToolTile.getTextEditor().type('{selectall}');
    clueCanvas.clickToolbarButton('text', 'bold');
    textToolTile.getTextEditor().last().should('have.descendants', 'strong');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'strong');
    clueCanvas.getRedoTool().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'strong');
    clueCanvas.getUndoTool().click();


    //Undo/Redo checks for Italic
    textToolTile.getTextEditor().type('{selectall}');
    clueCanvas.clickToolbarButton('text', 'italic');
    textToolTile.getTextEditor().last().should('have.descendants', 'em');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'em');
    clueCanvas.getRedoTool().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'em');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'em');

    //Undo/Redo checks for Underline
    textToolTile.getTextEditor().type('{selectall}');
    clueCanvas.clickToolbarButton('text', 'underline');
    textToolTile.getTextEditor().last().should('have.descendants', 'u');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'u');
    clueCanvas.getRedoTool().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'u');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'u');

    //Undo/Redo checks for Subscript
    textToolTile.getTextEditor().type('{selectall}');
    clueCanvas.clickToolbarButton('text', 'subscript');
    textToolTile.getTextEditor().last().should('have.descendants', 'sub');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'sub');
    clueCanvas.getRedoTool().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'sub');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'sub');

    //Undo/Redo checks for Superscript
    textToolTile.getTextEditor().type('{selectall}');
    clueCanvas.clickToolbarButton('text', 'superscript');
    textToolTile.getTextEditor().last().should('have.descendants', 'sup');
    clueCanvas.getUndoTool().click();
    textToolTile.getTextEditor().last().should('not.have.descendants', 'sup');
    clueCanvas.getRedoTool().click();
    textToolTile.getTextEditor().last().should('have.descendants', 'sup');
  });

  // Highlighting tool test as it was working as of this morning (June 27, 2025).
  // TODO: Move this into the first test in this file and add checks that highlight actually happens in the editor.
  it('Text Tool Highlight Functionality', function () {
    beforeTest();

    cy.log('Add text tool and enter sample text');
    const text = 'This is a sample text for testing highlight functionality.';
    clueCanvas.addTile('text');
    textToolTile.verifyTextTileIsEditable();
    textToolTile.enterText(text);
    textToolTile.getTextTile().last().should('contain', 'This is a sample text for testing highlight functionality');

    cy.log('Verify highlight toolbar button exists and is disabled when no text is selected');
    textToolTile.getHighlightButton().should('exist');
    textToolTile.getHighlightButton().should('be.disabled');

    cy.log('Select text using keyboard selection');
    textToolTile.getTextEditor().last().click();
    textToolTile.getTextEditor().last().type('{selectall}');

    // Wait a moment for the selection to be processed
    cy.wait(500);

    cy.log('Verify highlight toolbar button becomes enabled when text is selected');
    textToolTile.getHighlightButton().should('not.be.disabled');

    cy.log('Click highlight toolbar button to create highlight');
    textToolTile.getHighlightButton().click();

    cy.log('Verify highlight button becomes selected');
    textToolTile.getHighlightButton().should('have.class', 'selected');

    cy.log('Verify highlight is added to the text');
    textToolTile.getTextEditor().last().find('.highlight-chip').should('exist');
    textToolTile.getTextEditor().last().find('.highlight-chip').should('contain.text', text);

    cy.log('Verify selected highlight is removed when clicking highlight button again');
    textToolTile.getHighlightButton().click();
    textToolTile.getHighlightButton().should('not.have.class', 'selected');
    textToolTile.getTextEditor().last().find('.highlight-chip').should('not.exist');
    textToolTile.getTextTile().last().should('contain', 'This is a sample text for testing highlight functionality');

    cy.log('Clean up - delete text tile');
    clueCanvas.deleteTile('text');
    textToolTile.getTextTile().should('not.exist');
  });

  // TODO: Implement copy and paste functionality tests. Simulating copy and paste may be tricky,
  // especially since the text editor is a `contenteditable` element instead of a native input
  // element (e.g. `<input>` or `<textarea>`).
  //
  // it('Text Tool Tile text copy and paste', function () {
  // });
});
