/**
 * Skip Links Accessibility Tests — Student View
 *
 * Tests the skip links navigation feature that allows keyboard users
 * to bypass repetitive navigation and jump directly to main content areas.
 *
 * Skip links tested in this file (student persona):
 * - "Skip to Lessons and Documents" → #resources-panel
 * - "Skip to Workspace" → #workspace-panel
 *
 * Teacher-specific cases (including the dashboard skip link) live in
 * skip_links_teacher_spec.js. The two files were split to keep each spec's
 * browser session below the renderer-crash memory threshold in CI.
 */

const queryParamsStudent = Cypress.config("qaUnitStudent5");

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('Skip Links Navigation', function () {

  describe('Student View', function () {

    beforeEach(function () {
      beforeTest(queryParamsStudent);
    });

    it('renders skip links for resources and workspace', function () {
      cy.log('Verify skip links navigation element exists');
      cy.get('nav.skip-links').should('exist');

      cy.log('Verify resources skip link exists with correct text and href');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Lessons and Documents')
        .should('have.attr', 'href', '#resources-panel');

      cy.log('Verify workspace skip link exists with correct text and href');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('have.attr', 'href', '#workspace-panel');

      cy.log('Verify dashboard skip link does NOT exist for students');
      cy.get('nav.skip-links').should('not.contain', 'Skip to Dashboard');
    });

    it('skip links are visually hidden until focused', function () {
      cy.log('Verify skip links are positioned off-screen initially');
      cy.get('nav.skip-links').then($nav => {
        // The nav should have a negative top position when not focused
        const rect = $nav[0].getBoundingClientRect();
        expect(rect.top).to.be.lessThan(0);
      });
    });

    it('skip links become visible when tabbed to', function () {
      cy.log('Tab to the skip links navigation');
      cy.get('body').realPress('Tab');

      cy.log('Verify skip links nav becomes visible (within viewport)');
      cy.get('nav.skip-links').then($nav => {
        const rect = $nav[0].getBoundingClientRect();
        expect(rect.top).to.be.greaterThan(-1);
      });

      cy.log('Verify the first skip link has focus');
      cy.focused().should('contain', 'Skip to Lessons and Documents');
    });

    it('navigates to resources panel when skip link is activated', function () {
      cy.log('Click the resources skip link');
      cy.get('body').realPress('Tab');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Lessons and Documents')
        .click();

      cy.log('Verify resources panel receives focus');
      cy.focused().should('have.id', 'resources-panel');
      cy.url().should('include', '#resources-panel');
    });

    it('navigates to workspace panel when skip link is activated', function () {
      cy.log('Click the workspace skip link');
      cy.get('body').realPress('Tab');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .click();

      cy.log('Verify workspace panel receives focus');
      cy.focused().should('have.id', 'workspace-panel');
      cy.url().should('include', '#workspace-panel');
    });

    it('can navigate through skip links with Tab key', function () {
      cy.log('Tab to first skip link');
      cy.get('body').realPress('Tab');
      cy.focused().should('contain', 'Skip to Lessons and Documents');

      cy.log('Tab to second skip link');
      cy.realPress('Tab');
      cy.focused().should('contain', 'Skip to Workspace');
    });

    it('activates skip link with Enter key', function () {
      cy.log('Tab to the workspace skip link');
      cy.get('body').realPress('Tab');
      cy.realPress('Tab');
      cy.focused().should('contain', 'Skip to Workspace');

      cy.log('Press Enter to activate');
      cy.realPress('Enter');

      cy.log('Verify navigation occurred');
      cy.focused().should('have.id', 'workspace-panel');
      cy.url().should('include', '#workspace-panel');
    });
  });

  describe('Panel Target Elements', function () {

    beforeEach(function () {
      beforeTest(queryParamsStudent);
    });

    it('resources panel has correct id attribute', function () {
      cy.get('#resources-panel').should('exist');
    });

    it('workspace panel has correct id attribute', function () {
      cy.get('#workspace-panel').should('exist');
    });

    it('panel elements have tabindex for focus management', function () {
      cy.log('Resources panel should be focusable');
      cy.get('#resources-panel').should('have.attr', 'tabindex', '-1');

      cy.log('Workspace panel should be focusable');
      cy.get('#workspace-panel').should('have.attr', 'tabindex', '-1');
    });
  });

  describe('Collapsed Panel Behavior', function () {

    beforeEach(function () {
      beforeTest(queryParamsStudent);
    });

    it('expands collapsed resources panel when skip link is activated', function () {
      cy.log('Collapse the resources panel');
      cy.collapseResourceTabs();

      cy.log('Verify resources panel is collapsed');
      cy.get('#resources-panel').should('have.class', 'collapsed');

      cy.log('Focus and activate the resources skip link');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Lessons and Documents')
        .focus()
        .realPress('Enter');

      cy.log('Verify resources panel is expanded and focused');
      cy.get('#resources-panel').should('not.have.class', 'collapsed');
      cy.focused().should('have.id', 'resources-panel');
      cy.url().should('include', '#resources-panel');
    });

    it('expands collapsed workspace panel when skip link is activated', function () {
      cy.log('Collapse the workspace panel');
      cy.collapseWorkspace();

      cy.log('Verify workspace panel is collapsed');
      cy.get('#workspace-panel').should('have.class', 'collapsed');

      cy.log('Focus and activate the workspace skip link');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .focus()
        .realPress('Enter');

      cy.log('Verify workspace panel is expanded and focused');
      cy.get('#workspace-panel').should('not.have.class', 'collapsed');
      cy.focused().should('have.id', 'workspace-panel');
      cy.url().should('include', '#workspace-panel');
    });
  });
});
