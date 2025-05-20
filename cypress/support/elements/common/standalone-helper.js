class StandaloneHelper {
  visitStandalone(url) {
    // Handle cross-origin errors
    cy.on('uncaught:exception', () => {
      return false; // We want to handle all uncaught exceptions in this test file
    });

    // Visit with cross-origin handling
    cy.visit(url);
  }

  selectOrCreateGroup(groupNumber) {
    // Only select a group if the group selection dialog is present
    cy.get('body').then($body => {
      if ($body.find('[data-testid=group-select]').length) {
        cy.get('[data-testid=group-select]', { timeout: 30000 }).should('exist');

        // Wait for the groups to be fully loaded
        cy.get('[data-testid=existing-groups]', { timeout: 30000 }).should('exist').then($groups => {
          const group = $groups.find(`[data-testid=existing-group-${groupNumber}]`);

          if (group.length > 0) {
            cy.get(`[data-testid=existing-group-${groupNumber}]`).should('exist').click({ force: true });
          } else {
            cy.get('[data-testid=new-group-select]').should('exist').select(groupNumber.toString());
            cy.get('[data-testid=create-group-button]').should('exist').click();
          }
        });

        // Wait for the navigation dropdown to appear with a longer timeout
        cy.get('[data-testid=problem-navigation-dropdown]', { timeout: 60000 }).should('exist');
      } else {
        cy.log('Group select dialog not present, continuing...');
      }
    });
  }

  startStandaloneSession() {
    // Click "Get Started" to begin authentication
    cy.get("[data-testid=standalone-welcome]", { timeout: 30000 }).should("exist");
    cy.get("[data-testid=standalone-get-started-button]").click();
  }

  logout() {
    // Click the user menu button
    cy.get("[data-test=user-header]").should("exist").click();

    // Click the logout button in the menu
    cy.get("[data-test=user-list]").should("exist");
    cy.get("[data-test=list-item-log-out]").should("exist").click();

    // Handle the portal confirmation dialog
    cy.origin('https://learn.portal.staging.concord.org', () => {
      // Wait for the page to load
      cy.get('body').should('exist');
      // Click the Yes button using the exact selector
      cy.get('input[name="confirm"]').click();
    });

    // Wait for redirect back to standalone page
    cy.url().should('include', '/standalone/');

    // Confirm the presence of the Get Started button
    cy.get("[data-testid=standalone-get-started-button]").should("exist");
  }

  // Navigation helpers can be added here when CLUE-143 is completed
}

export default StandaloneHelper;
