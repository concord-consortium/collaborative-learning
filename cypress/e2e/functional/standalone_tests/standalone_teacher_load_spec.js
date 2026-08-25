import StandaloneHelper from "../../../support/elements/common/standalone-helper";

const standaloneHelper = new StandaloneHelper();

context('Standalone CLUE Teacher', () => {
  beforeEach(() => {
    // Load teacher test data from fixture
    cy.fixture('standalone-teacher-test-data.json').then((testData) => {
      cy.intercept('GET', '**/api/v1/jwt/portal/**', { statusCode: 200, body: testData.jwt }).as('getJWT');
      cy.intercept('GET', '**/api/v1/users/**', { statusCode: 200, body: testData.user }).as('getUserInfo');
      cy.intercept('GET', '**/api/v1/offerings/**', { statusCode: 200, body: testData.offerings }).as('getOfferings');
    });

    // Login as teacher before each test
    cy.portalLogin({ userType: 'teacher' }); // Adjust helper as needed
  });

  it('should load standalone teacher page and show teacher-specific UI', () => {
    standaloneHelper.visitStandalone('/standalone/?unit=msa');
    cy.get('[data-testid=standalone-get-started-button]').click();
    // Teacher Guide is a teacher-only tab. Class Work only appears once the standalone auth
    // handoff finishes, since standalone mode shows just the curriculum tabs until then.
    cy.get('[data-testid=nav-tab-teacher-guide]').should('be.visible');
    cy.get('[data-testid=nav-tab-sort-work]').should('be.visible');

    // Verify we're logged in by checking for the user menu
    cy.get("[data-testid=custom-select-header]")
      .should("exist")
      .click();

    // Stub the clipboard writeText method
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('writeText').returns(Promise.resolve());
    });

    // Click the Copy Shareable Link menu item
    cy.get('[data-testid=list-item-copy-shareable-link]')
      .should("exist")
      .click();
    cy.log('Clicked Copy Shareable Link');

    // Assert that clipboard.writeText was called
    cy.get('@writeText').should('have.been.called');

    // Wait for the dialog to appear
    cy.wait(2000);

    // Check for either success or error dialog
    cy.get('[data-testid=dialog-text]')
      .should('be.visible')
      .and('contain.text', 'The shareable link has been copied to the clipboard');
  });
});
