import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";

let sortWork = new SortedWork();
let dashboard = new TeacherDashboard();

const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitTeacher1")}`;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  cy.openTopTab("sort-work");
  cy.wait(1000);
}

// NOTE: this test file is separate from the other teacher_sort_work_view_spec_n.js files
// due to Cypress running out of memory when running all tests.

describe("SortWorkView Problem Sort Tests", () => {
  it("allows documents to be sorted by Problem as primary sort option", () => {
    beforeTest(queryParams1);

    cy.log("verify Problem option exists in primary sort menu");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");
    sortWork.getPrimarySortByProblemOption().should("exist");
    sortWork.getPrimarySortByProblemOption().click();
    sortWork.getPrimarySortByProblemOption().should("have.class", "selected");
    sortWork.getPrimarySortByGroupOption().should("not.have.class", "selected");

    cy.log("verify documents are organized by problem when Problem sort is applied");
    cy.get(".section-header-arrow").click({multiple: true}); // Open the sections
    cy.get(".section-header-label").should("exist");
    // Section headers show the problem's title when the unit provides one (this unit's titles
    // begin with the "X.Y" ordinal, e.g. "1.1 Unit Toolbar Configuration"), falling back to
    // "Problem X.Y", or "No Problem" for ungrouped work.
    cy.get(".section-header-label").then($headers => {
      const headerTexts = Array.from($headers).map(el => el.textContent.trim());
      expect(headerTexts.length).to.be.greaterThan(0);
      const problemRegex = /(^\d+\.\d+|Problem \d+\.\d+|No Problem)/;
      headerTexts.forEach(headerText => {
        expect(headerText).to.match(problemRegex);
      });
    });

    cy.log("verify switching from Problem to other primary sort options works");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByNameOption().click();
    sortWork.getPrimarySortByNameOption().should("have.class", "selected");
    sortWork.getPrimarySortByProblemOption().should("not.have.class", "selected");

    cy.log("verify switching back to Problem sort works");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByProblemOption().click();
    sortWork.getPrimarySortByProblemOption().should("have.class", "selected");
  });

  it("keeps the 'Show for' scope (no auto-switch) but disables the Problem scope option when sorting by Problem", () => {
    beforeTest(queryParams1);

    cy.log("set 'Show for' filter to Problem");
    sortWork.getShowForMenu().click();
    sortWork.getShowForProblemOption().click();
    sortWork.getShowForProblemOption().should("have.class", "selected");

    cy.log("verify Group is the selected primary sort option");
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");

    cy.log("switch primary sort to Problem - 'Show for' scope should NOT auto-switch to Investigation");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByProblemOption().click();
    sortWork.getPrimarySortByProblemOption().should("have.class", "selected");

    cy.log("verify 'Show for' scope was retained (Problem), not force-switched to Investigation");
    sortWork.getShowForProblemOption().should("have.class", "selected");
    sortWork.getShowForInvestigationOption().should("not.have.class", "selected");

    cy.log("verify Problem option in 'Show for' menu is disabled when sorting by Problem");
    sortWork.getShowForMenu().click();
    sortWork.getShowForProblemOption().should("have.class", "disabled");
    sortWork.getShowForInvestigationOption().should("not.have.class", "disabled");
    sortWork.getShowForUnitOption().should("not.have.class", "disabled");
    sortWork.getShowForAllOption().should("not.have.class", "disabled");

    cy.log("switch primary sort away from Problem - Problem filter option should become enabled again");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().click();

    sortWork.getShowForMenu().click();
    sortWork.getShowForProblemOption().should("not.have.class", "disabled");
  });

  it("properly handles Problem as primary sort with secondary sort interactions", () => {
    beforeTest(queryParams1);

    cy.log("set primary sort to Problem");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByProblemOption().click();
    sortWork.getPrimarySortByProblemOption().should("have.class", "selected");

    cy.log("verify secondary sort options are available when primary is Problem");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("exist").and("have.class", "enabled");
    sortWork.getSecondarySortByNameOption().should("exist").and("have.class", "enabled");
    sortWork.getSecondarySortByDateOption().should("exist").and("have.class", "enabled");
    // Problem should be disabled in the secondary sort options when it's the primary sort
    sortWork.getSecondarySortByProblemOption().should("have.class", "disabled");

    cy.log("apply secondary sort by Name when primary is Problem");
    sortWork.getSecondarySortByNameOption().click();
    sortWork.getSecondarySortByNameOption().should("have.class", "selected");

    cy.log("verify section sub-headers show 'Name' for secondary sort");
    cy.get("[data-testid=section-sub-header]").each($el => {
      cy.wrap($el).should("exist").and("have.text", "Name");
    });

    cy.log("verify switching primary sort from Problem enables Problem in secondary");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().click();

    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByProblemOption().should("have.class", "enabled");
    sortWork.getSecondarySortByGroupOption().should("have.class", "disabled");
  });
});
