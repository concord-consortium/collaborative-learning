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
    // Wait for the group selection dialog and select Group 1
    cy.get("[data-testid=group-select]", { timeout: 30000 }).should("exist");

    // Wait for the groups to be fully loaded
    cy.get("[data-testid=existing-groups]", { timeout: 30000 }).should("exist").then($groups => {
      // Store the group element if it exists
      const group = $groups.find(`[data-testid=existing-group-${groupNumber}]`);

      if (group.length > 0) {
        // If Group exists, click it using force option to handle any overlay issues
        cy.get(`[data-testid=existing-group-${groupNumber}]`).should("exist").click({ force: true });
      } else {
        // If Group doesn't exist, create it
        cy.get("[data-testid=new-group-select]").should("exist").select(groupNumber.toString());
        cy.get("[data-testid=create-group-button]").should("exist").click();
      }
    });

    // Wait for the navigation dropdown to appear with a longer timeout
    cy.get("[data-testid=problem-navigation-dropdown]", { timeout: 60000 }).should("exist");
  }

  startStandaloneSession() {
    // Click "Get Started" to begin authentication
    cy.get("[data-testid=standalone-welcome]", { timeout: 30000 }).should("exist");
    cy.get("[data-testid=standalone-get-started-button]").click();
  }

  // Navigation helpers can be added here when CLUE-143 is completed
}

export default StandaloneHelper;
