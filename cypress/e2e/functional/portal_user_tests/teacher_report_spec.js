const portalUrl = "https://learn.portal.staging.concord.org";
const offeringId1 = "279";
const reportUrl1 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId1 + "/external_report/11";
const clueTeacher1 = {
  username: "clueteachertest1",
  password: "password"
};

describe('Teachers can launch the CLUE Report', () => {
  it("rewrites the URL of the CLUE report so it can be reloaded", () => {
    cy.login(portalUrl, clueTeacher1);
    cy.launchReport(reportUrl1);
    cy.waitForLoad();

    // check the URL
    cy.url()
      .should("contain", `resourceLinkId=${offeringId1}`)
      .should("contain", "authDomain=https%3A%2F%2Flearn.portal.staging.concord.org")
      .should("not.contain", "token=");

    cy.get(".header").should("contain", "Clue Teacher1");

    // With the OAuth2 url params a reload should get us back to Clue Teacher1 without going to
    // the portal first
    cy.reload();

    cy.get(".header").should("contain", "Clue Teacher1");
  });
});
