/**
 * Skip Links Accessibility Tests — Teacher View
 *
 * Tests the skip links navigation feature that allows keyboard users
 * to bypass repetitive navigation and jump directly to main content areas.
 *
 * Skip links tested in this file (teacher persona):
 * - "Skip to Lessons and Documents" → #resources-panel
 * - "Skip to Workspace" → #workspace-panel
 * - "Skip to Dashboard" → #main-dashboard (teacher only)
 *
 * Student-specific cases live in skip_links_student_spec.js. The two files
 * were split to keep each spec's browser session below the renderer-crash
 * memory threshold in CI.
 */

const queryParamsTeacher = Cypress.config("qaUnitTeacher6");

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('Skip Links Navigation', function () {

  describe('Teacher View', function () {

    beforeEach(function () {
      beforeTest(queryParamsTeacher);
    });

    it('shows resources and workspace skip links in workspace view', function () {
      cy.log('Verify in workspace view by default');
      cy.get('.workspace').should('be.visible');

      cy.log('Verify resources skip link exists');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Lessons and Documents')
        .should('exist');

      cy.log('Verify workspace skip link exists');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('exist');

      cy.log('Verify dashboard skip link does NOT exist when in workspace view');
      cy.get('nav.skip-links').should('not.contain', 'Skip to Dashboard');
    });

    it('shows dashboard skip link when in dashboard view', function () {
      cy.log('Switch to dashboard view');
      cy.get('.toggle-button').contains('Dashboard').click();

      cy.log('Verify in dashboard');
      // Note: #main-dashboard has 0 height because .tabbed-area uses position:fixed,
      // so we check the visible child element instead
      cy.get('#main-dashboard .tabbed-area').should('be.visible');

      cy.log('Verify dashboard skip link exists');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .should('exist')
        .and('have.attr', 'href', '#main-dashboard');

      cy.log('Verify workspace/resources skip links do NOT exist in dashboard view');
      cy.get('nav.skip-links').should('not.contain', 'Skip to Lessons and Documents');
      cy.get('nav.skip-links').should('not.contain', 'Skip to Workspace');
    });

    it('navigates to dashboard when skip link is activated', function () {
      cy.log('Switch to dashboard view');
      cy.get('.toggle-button').contains('Dashboard').click();
      cy.get('#main-dashboard .tabbed-area').should('be.visible');

      cy.log('Click the dashboard skip link');
      cy.get('body').realPress('Tab');
      // The skip link is positioned off-screen until focused (sr-only style); force the
      // click since the auto-actionability check can race with the focus-driven reveal.
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .click({ force: true });

      cy.log('Verify dashboard receives focus');
      cy.focused().should('have.id', 'main-dashboard');
      cy.url().should('include', '#main-dashboard');
    });

    it('skip links update when switching between workspace and dashboard', function () {
      cy.log('Initially in workspace view, verify workspace skip links');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('exist');

      cy.log('Switch to dashboard');
      cy.get('.toggle-button').contains('Dashboard').click();
      cy.get('#main-dashboard .tabbed-area').should('be.visible');

      cy.log('Verify dashboard skip link appears');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .should('exist');

      cy.log('Verify workspace skip links are gone');
      cy.get('nav.skip-links').should('not.contain', 'Skip to Workspace');

      cy.log('Switch back to workspace');
      cy.get('.toggle-button').contains('Workspace').click();
      cy.get('.workspace').should('be.visible');

      cy.log('Verify workspace skip links return');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('exist');

      cy.log('Verify dashboard skip link is gone');
      cy.get('nav.skip-links').should('not.contain', 'Skip to Dashboard');
    });
  });

  describe('Teacher Dashboard Target Element', function () {

    beforeEach(function () {
      beforeTest(queryParamsTeacher);
      cy.get('.toggle-button').contains('Dashboard').click();
      cy.get('#main-dashboard .tabbed-area').should('be.visible');
    });

    it('dashboard element is focusable', function () {
      cy.get('#main-dashboard').should('have.attr', 'tabindex', '-1');
    });
  });
});
