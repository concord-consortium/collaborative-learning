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
  it('playback stops at injected failing history entry', function () {
    const teacherParams = `${Cypress.config("qaUnitTeacher6")}`;
    cy.visit(teacherParams, {
      onBeforeLoad(win) {
        win.localStorage.setItem("debug", "historyView");
      }
    });
    cy.waitForLoad();

    cy.log('create some history by adding a text tile');
    clueCanvas.addTile('text');
    textToolTile.enterText('Some content');

    cy.log('open history view and inject a failing entry');
    cy.get('.primary-workspace .toolbar .tool.historyview').click();
    cy.get('.history-view-panel').should('be.visible');
    cy.get('.inject-failing-entry').click();

    cy.log('wait for the injected entry to appear in remote (Firestore) history');
    // Turn on remote history and wait for the injectFailingHistoryEntry
    // action to show up there. This is deterministic — it confirms the
    // injected entry has been persisted to Firestore before the teacher
    // opens the document from My Work (which loads history from Firestore).
    cy.get('.history-view-toggle input[type="checkbox"]').click();
    cy.get('.history-view-section').last().within(() => {
      cy.get('.history-entry-item', { timeout: 4000 })
        .contains('injectFailingHistoryEntry')
        .should('exist');
    });
    cy.get('.history-view-close').click();

    cy.log('open my-work tab and open the document to get playback controls');
    clueCanvas.getInvestigationCanvasTitle().text().then((investigationTitle) => {
      cy.openTopTab('my-work');
      cy.openDocumentThumbnail('my-work', 'workspaces', investigationTitle);
    });

    cy.log('open playback controls');
    cy.get('.toolbar .tool.toggleplayback').click();
    cy.get('[data-testid="playback-slider"]').should('be.visible');

    cy.log('scrub to beginning — should be blocked by failing entry');
    cy.get('[data-testid="playback-slider"] .rc-slider-horizontal').then($slider => {
      const width = $slider.width();
      cy.wrap($slider).click(width * 0.05, 0);
    });

    cy.log('verify failure marker appears and is clickable');
    cy.get('.playback-failure-marker').should('exist');
    cy.get('.playback-failure-marker').click();
    cy.get('[data-testid="playback-failure-detail"]').should('be.visible');
    cy.get('.playback-failure-detail-body').should('contain', 'NONEXISTENT_TILE');

    // The slider opens at the end-of-history position. The backward
    // scrub above fails immediately on the last history entry (the
    // injected failing one), so no backward progress is made and
    // numHistoryEventsApplied stays at history.length. The slider
    // handle should stay at the end position — not snap back to the
    // user-clicked target near the start. Regression coverage for
    // Copilot review comment #4 on CLUE-494.
    cy.log('verify slider stays at end when failure blocks all backward progress');
    cy.get('[data-testid="playback-slider"] .rc-slider-handle')
      .should($handle => {
        const now = Number($handle.attr('aria-valuenow'));
        const max = Number($handle.attr('aria-valuemax'));
        expect(now).to.equal(max);
      });
  });

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
