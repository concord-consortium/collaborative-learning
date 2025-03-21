import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import QuestionToolTile from '../../../support/elements/tile/QuestionToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const questionToolTile = new QuestionToolTile;
let title = "QA 1.1 Solving a Mystery with Proportional Reasoning";
let copyTitle = 'Question Tile Workspace Copy';

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Question tool tile functionalities', function () {
  it('add and delete question tile', function () {
    beforeTest();

    cy.log('adds question tile');
    clueCanvas.addTile('question');
    questionToolTile.getQuestionTile().should('exist');

    // Question tile restore upon page reload
    cy.wait(1000);
    cy.reload();
    cy.waitForLoad();
    questionToolTile.getQuestionTile().should('exist');

    cy.log('verifies restore of question tile');
    canvas.createNewExtraDocumentFromFileMenu('question tool test', 'my-work');
    cy.wait(2000);
    questionToolTile.getQuestionTile().should('not.exist');

    //re-open investigation
    canvas.openDocumentWithTitle('workspaces', title);
    questionToolTile.getQuestionTile().should('exist');

    cy.log('verifies restore of question tile in copy document');
    //copy investigation
    canvas.copyDocument(copyTitle);
    canvas.getPersonalDocTitle().should('contain', copyTitle);
    questionToolTile.getQuestionTile().should('exist');
    canvas.deleteDocument();

    cy.log('delete question tile');
    clueCanvas.deleteTile('question');
    questionToolTile.getQuestionTile().should('not.exist');
  });

  it('Question Tool Undo/Redo', function () {
    beforeTest();

    cy.log('will undo redo state');
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");

    cy.log('will undo redo question tile creation/deletion');
    // Creation - Undo/Redo
    clueCanvas.addTile('question');
    questionToolTile.getQuestionTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    questionToolTile.getQuestionTile().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    questionToolTile.getQuestionTile().should("exist");

    // Deletion - Undo/Redo
    clueCanvas.deleteTile('question');
    questionToolTile.getQuestionTile().should('not.exist');
    clueCanvas.getUndoTool().click();
    questionToolTile.getQuestionTile().should("exist");
    clueCanvas.getRedoTool().click();
    questionToolTile.getQuestionTile().should('not.exist');
  });

  it('Question tile title edit and undo/redo', function () {
    beforeTest();

    cy.log('edit tile title');
    const newName = "Test updated title";
    clueCanvas.addTile('question');
    questionToolTile.getTileTitle().first().should("contain", "Question 1");

    // Click the title to start editing
    questionToolTile.getQuestionTileTitle().first().click();
    // Wait for the editing class to be added
    questionToolTile.getQuestionTileTitle().first().should('have.class', 'editable-tile-title-editing');
    // Type the new title
    questionToolTile.getQuestionTileTitle().first().type(newName + '{enter}');
    // Verify the new title is displayed
    questionToolTile.getTileTitle().should("contain", newName);

    cy.log('undo redo title edit');
    clueCanvas.getUndoTool().click();
    questionToolTile.getTileTitle().first().should("contain", "Question 1");
    clueCanvas.getRedoTool().click();
    questionToolTile.getTileTitle().should("contain", newName);
  });
});
