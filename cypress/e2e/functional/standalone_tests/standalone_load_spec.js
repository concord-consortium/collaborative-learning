const url = "/standalone/";

function beforeTest() {
  cy.visit(url);
}

context('Standalone', () => {
  it('verify standalone page loads', function () {
    beforeTest();

    cy.log("verify placeholder");
    cy.get("[data-test=standalone-placeholder]").should("exist");

    cy.log("verify only problems tab is visible");
    cy.get(".tab-problems").should("exist");
    const filteredTabs = ["my-work", "sort-work"];
    for (const tab of filteredTabs) {
      cy.get(`.tab-${tab}`).should("not.exist");
    }

    cy.log("verify problem panel toolbar is not visible");
    cy.get(".problem-panel .toolbar").should("not.exist");

    cy.log("verify user info is not visible");
    cy.get(".app-header .user").should("not.exist");
  });
});
