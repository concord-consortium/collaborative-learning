/**
 * Skip Links Accessibility Tests
 *
 * Tests the skip links navigation feature that allows keyboard users
 * to bypass repetitive navigation and jump directly to main content areas.
 *
 * Skip links tested:
 * - "Skip to Lessons and Documents" → #resources-panel
 * - "Skip to Workspace" → #workspace-panel
 * - "Skip to Dashboard" → #main-dashboard (teacher only)
 */

const queryParamsStudent = `${Cypress.config("qaUnitStudent5")}`;
const queryParamsTeacher = `${Cypress.config("qaUnitTeacher6")}`;

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
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .should('not.exist');
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
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .should('not.exist');
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
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Lessons and Documents')
        .should('not.exist');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('not.exist');
    });

    it('navigates to dashboard when skip link is activated', function () {
      cy.log('Switch to dashboard view');
      cy.get('.toggle-button').contains('Dashboard').click();
      cy.get('#main-dashboard .tabbed-area').should('be.visible');

      cy.log('Click the dashboard skip link');
      cy.get('body').realPress('Tab');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .click();

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
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('not.exist');

      cy.log('Switch back to workspace');
      cy.get('.toggle-button').contains('Workspace').click();
      cy.get('.workspace').should('be.visible');

      cy.log('Verify workspace skip links return');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Workspace')
        .should('exist');

      cy.log('Verify dashboard skip link is gone');
      cy.get('nav.skip-links a.skip-link')
        .contains('Skip to Dashboard')
        .should('not.exist');
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

  describe('Teacher Dashboard Target Element', function () {

    beforeEach(function () {
      beforeTest(queryParamsTeacher);
      cy.get('.toggle-button').contains('Dashboard').click();
      cy.get('#main-dashboard .tabbed-area').should('be.visible');
    });

    it('dashboard element has correct id attribute', function () {
      cy.get('#main-dashboard').should('exist');
    });

    it('dashboard element is focusable', function () {
      cy.get('#main-dashboard').should('have.attr', 'tabindex', '-1');
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
