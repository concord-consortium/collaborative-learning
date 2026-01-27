import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

let clueCanvas = new ClueCanvas;
let textToolTile = new TextToolTile;

const queryParams = `${Cypress.config("qaUnitStudent5")}`;

function beforeTest(params) {
  cy.visit(params, {
    onBeforeLoad(win) {
      // Enable the history view debug flag before the page loads
      win.localStorage.setItem("debug", "historyView");
    }
  });
  cy.waitForLoad();
}

context('History View Panel', () => {
  it('opens panel and shows local and remote history', function () {
    beforeTest(queryParams);

    cy.log('verify history view button is visible when debug flag is set');
    cy.get('.primary-workspace .toolbar .tool.historyview').should('be.visible');

    cy.log('create some history by adding a text tile and typing');
    clueCanvas.addTile('text');
    textToolTile.enterText('Test content for history');

    cy.log('open the history view panel');
    cy.get('.primary-workspace .toolbar .tool.historyview').click();

    cy.log('verify history view panel is visible');
    cy.get('.history-view-panel').should('be.visible');
    cy.get('.history-view-header').should('contain', 'Document History');

    cy.log('verify local history section shows entries');
    cy.get('.history-view-section').first().within(() => {
      cy.get('.history-view-section-header').should('contain', 'Local History');
      // Should have at least one entry from adding the text tile
      cy.get('.history-view-count').should('not.contain', '0 entries');
      cy.get('.history-entry-item').should('have.length.at.least', 1);
    });

    cy.log('verify can expand a history entry to see details');
    cy.get('.history-entry-item').first().within(() => {
      cy.get('.history-entry-summary').click();
      cy.get('.history-entry-details').should('be.visible');
    });

    cy.log('toggle remote history on');
    cy.get('.history-view-toggle input[type="checkbox"]').click();

    cy.log('verify remote history section appears');
    // Wait for Firestore to return results (may take a moment)
    cy.get('.history-view-section').should('have.length', 2);
    cy.get('.history-view-section').last().within(() => {
      cy.get('.history-view-section-header').should('contain', 'Remote History');
      // Remote history should have entries (may need a short wait for Firestore)
      cy.get('.history-view-count', { timeout: 10000 }).should('not.contain', '0 entries');
      cy.get('.history-entry-item').should('have.length.at.least', 1);
    });

    cy.log('verify panel can be closed');
    cy.get('.history-view-close').click();
    cy.get('.history-view-panel').should('not.exist');
  });
});
