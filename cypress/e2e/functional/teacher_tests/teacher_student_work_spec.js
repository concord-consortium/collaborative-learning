import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import ResourcesPanel from '../../../support/elements/common/ResourcesPanel';

const studentQueryParams = `${Cypress.config("qaUnitStudent5")}`;
const teacherQueryParams = `${Cypress.config("qaUnitTeacher6")}`;

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const resourcesPanel = new ResourcesPanel;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  cy.openTopTab("problems");
}

const sampleText = "Text for studentDocument view test";

// This URL parameter is usually used by researchers, but works for teachers as well
context('Teacher can use studentDocument URL parameter', () => {
  it('Allows teacher to link to student work', () => {
    cy.log('Log in as student and put content into problem document');
    beforeTest(studentQueryParams);
    clueCanvas.addTile('text');
    textToolTile.enterText(sampleText);
    textToolTile.getTextTile().last().should('contain', sampleText);
    // Click outside the text area to save the text
    clueCanvas.getPlaceHolder().first().click();
    // Store the ID of the document for later use
    clueCanvas.getSingleWorkspaceDocumentContent().invoke('attr', 'data-document-key').then((documentId) => {
      cy.log(`Document ID: ${documentId}`);
      cy.wrap(documentId).as('documentId').should('not.be.undefined');
    });
    cy.wait(1000); // Give some time for the document to save

    cy.log('Log in as teacher and view student work');
    cy.get('@documentId').then((id) => {
      expect(id).to.not.be.undefined;
      cy.visit(teacherQueryParams + '&studentDocument=' + id);
      cy.waitForLoad();

      resourcesPanel.getPrimaryWorkspaceTab('student-work').should('have.class', 'selected');
      resourcesPanel.getEditableDocumentContent()
        .should('have.attr', 'data-document-key', id)
        .should('have.class', 'read-only')
        .should('contain', sampleText);
    });

  });

});
