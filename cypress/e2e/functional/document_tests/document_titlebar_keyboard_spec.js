/**
 * Keyboard interaction tests for the document title bar.
 *
 * - Every focusable title bar control is reachable by tabbing, in the
 *   expected order.
 * - The edit title button opens the rename dialog on Enter and the dialog
 *   stays visible after the keystroke completes.
 * - Submitting (Enter) and cancelling (Escape) the rename dialog both
 *   restore focus to the edit title button.
 */

import Canvas from '../../../support/elements/common/Canvas';
import Dialog from '../../../support/elements/common/Dialog';

const canvas = new Canvas();
const dialog = new Dialog();

const queryParams = Cypress.config('qaUnitStudent5');
const initialTitle = 'Title Bar Keyboard Test';
const renamedTitle = 'Title Bar Keyboard Test Renamed';

function setupExtraDocument() {
  cy.visit(queryParams);
  cy.waitForLoad();
  canvas.createNewExtraDocumentFromFileMenu(initialTitle, 'my-work');
}

context('Document title bar — keyboard interactions', function () {
  beforeEach(function () {
    setupExtraDocument();
  });

  context('tab navigation', function () {
    it('tabs through every focusable title bar control in the expected order', function () {
      // Strict ordered walk: every focusable title bar control in this
      // fixture, in DOM (and tab) order. If the title bar's controls
      // change — added, removed, or reordered — update this list to match.
      const expectedTabOrder = [
        '[data-test=document-file-menu-header]',
        '[data-testid=annotation-mode-button]',
        '[data-testid=hide-annotations-button]',
        '[data-test=ideas-button]',
        '[data-test=doc-rename-button]',
        '[data-test=share-button]',
      ];

      cy.get(expectedTabOrder[0]).focus();
      cy.focused().should('match', expectedTabOrder[0]);
      for (let i = 1; i < expectedTabOrder.length; i++) {
        cy.realPress('Tab');
        cy.focused().should('match', expectedTabOrder[i]);
      }
    });
  });

  context('edit title button', function () {
    it('can be reached by keyboard focus', function () {
      canvas.getDocRenameButton().focus();
      cy.focused().should('have.attr', 'data-test', 'doc-rename-button');
    });

    it('opens the rename dialog on Enter and the dialog stays visible', function () {
      canvas.getDocRenameButton().focus();
      cy.realPress('Enter');
      dialog.getDialogTitle().should('contain', 'Rename Extra Workspace');
      dialog.getDialogTextInput().should('be.visible').and('be.focused');
      dialog.getDialogTextInput().should('be.visible');
      dialog.getDialogTitle().should('be.visible').and('contain', 'Rename Extra Workspace');
    });

    it('submits the new title on Enter and restores focus to the edit title button', function () {
      canvas.getDocRenameButton().focus();
      cy.realPress('Enter');
      dialog.getDialogTextInput()
        .should('be.visible')
        .type('{selectall}{backspace}' + renamedTitle);
      cy.realPress('Enter');
      dialog.getDialogTitle().should('not.exist');
      canvas.getPersonalDocTitle().should('contain', renamedTitle);
      cy.focused().should('have.attr', 'data-test', 'doc-rename-button');
    });

    it('cancels on Escape, leaves the title unchanged, and restores focus to the edit title button', function () {
      canvas.getDocRenameButton().focus();
      cy.realPress('Enter');
      dialog.getDialogTextInput()
        .should('be.visible')
        .type('{selectall}{backspace}should not be applied');
      cy.realPress('Escape');
      dialog.getDialogTitle().should('not.exist');
      canvas.getPersonalDocTitle().should('contain', initialTitle);
      cy.focused().should('have.attr', 'data-test', 'doc-rename-button');
    });
  });

});
