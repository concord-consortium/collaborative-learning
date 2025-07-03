import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import ResourcesPanel from '../../../support/elements/common/ResourcesPanel';
import Canvas from '../../../support/elements/common/Canvas';
import { LogEventName } from "../../../../src/lib/logger-types";

const studentQueryParams = `${Cypress.config("qaUnitStudent5")}`;
const teacherQueryParams = `${Cypress.config("qaUnitTeacher6")}`;

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const resourcesPanel = new ResourcesPanel;
const canvas = new Canvas;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  cy.window().then(win => {
    cy.stub(win.ccLogger, "log").as("log");
  });
}

const initialText = "Initial text for studentDocument view test";
const additionalText = "Added after the history checkpoint";

// This URL parameter is usually used by researchers, but works for teachers as well
context('Teacher can use studentDocument URL parameter', () => {
  it('Allows teacher to link to student work', () => {
    cy.log('Log in as student and put content into problem document');
    beforeTest(studentQueryParams);
    clueCanvas.addTile('text');

    cy.get("@log")
      .its("lastCall.args.0")
        .should("eq", LogEventName.CREATE_TILE);

    cy.get("@log")
      .its("lastCall.args.1")
        .should("include", { objectType: "Text" })
        .should("have.a.property", "documentHistoryId", "first");

    textToolTile.enterText(initialText);
    textToolTile.getTextTile().last().should('contain', initialText);
    // Click outside the text area to save the text
    clueCanvas.getPlaceHolder().first().click();

    // Store the ID of the document for later use
    clueCanvas.getSingleWorkspaceDocumentContent().invoke('attr', 'data-document-key').then((documentId) => {
      cy.log(`Document ID: ${documentId}`);
      cy.wrap(documentId).as('documentId').should('not.be.undefined');
    });

    // We want the history entry after initial text has been added.
    // That will be logged as part of the NEXT event.
    textToolTile.enterText(' ');
    clueCanvas.getPlaceHolder().first().click();

    // Hold onto the document history ID at this point for later
    cy.get("@log")
    .should("have.been.calledWith", LogEventName.TEXT_TOOL_CHANGE, Cypress.sinon.match.object)
    .its("lastCall.args.1")
      .should("include.keys", "documentKey", "documentHistoryId")
      .then((args) => {
        cy.wrap(args.documentHistoryId).as('documentHistoryId').should('not.be.undefined');
      });

    // Make additional changes after that point in the history
    textToolTile.enterText(additionalText);

    cy.wait(1000); // Give some time for the document to save

    cy.log('Log in as teacher and view student work');
    cy.get('@documentId').then((docId) => {
      expect(docId).to.not.be.undefined;
      cy.visit(teacherQueryParams + '&studentDocument=' + docId);
      cy.waitForLoad();

      resourcesPanel.getPrimaryWorkspaceTab('student-work').should('have.class', 'selected');
      resourcesPanel.getEditableDocumentContent()
        .should('have.attr', 'data-document-key', docId)
        .should('have.class', 'read-only')
        .should('contain', initialText)
        .should('contain', additionalText);

      // Verify the 4-up button is visible and enabled in the toolbar when student tab is in view
      cy.log('Verify the 4-up button is visible and enabled in the toolbar when student tab is in view');
      clueCanvas.getFourUpToolbarButton().should('be.visible').should('have.class', 'enabled');

      // Verify other toolbar buttons are still visible and functional
      cy.get('[data-testid="toolbar"]').should('be.visible');

      // Click the 4-up button to enter 4-up view
      clueCanvas.getFourUpToolbarButton().click();

      // Verify the 4-up view contains the student document in the Northwest quadrant
      clueCanvas.getNorthWestCanvas().should('be.visible');
      clueCanvas.getNorthWestCanvas().should('contain', initialText);

      // Verify the 4-up button is still visible in 4-up view
      clueCanvas.getFourUpToolbarButton().should('be.visible');

      // Click the 4-up button to exit 4-up view
      clueCanvas.getFourUpToolbarButton().click();

      // Verify we're back to single view
      canvas.getSingleCanvas().should('be.visible');

    });

    // cy.log('Log in as teacher with history ID');
    // cy.get('@documentId').then((docId) => {
    //   cy.get('@documentHistoryId').then((docHistoryId) => {
    //     expect(docId).to.not.be.undefined;
    //     expect(docHistoryId).to.not.be.undefined;
    //     cy.visit(teacherQueryParams + '&studentDocument=' + docId + "&studentDocumentHistoryId=" + docHistoryId);
    //     cy.waitForLoad();

    //     resourcesPanel.getPrimaryWorkspaceTab('student-work').should('have.class', 'selected');
    //     resourcesPanel.getEditableDocumentContent()
    //       .should('have.attr', 'data-document-key', docId)
    //       .should('have.class', 'read-only')
    //       .should('contain', initialText)
    //       .should('not.contain', additionalText);
    //   });
    // });
  });
});
