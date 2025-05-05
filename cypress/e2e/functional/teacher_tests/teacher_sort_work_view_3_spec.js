import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";

let sortWork = new SortedWork;
let dashboard = new TeacherDashboard;

const queryParams1 = `${Cypress.config("clueTestqaConfigSubtabsUnitTeacher6")}`;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  cy.openTopTab('sort-work');
  cy.wait(1000);
}

//TODO: For QA (1/24)
// Write a test that confirms correct behavior for "Sort by Tools"
// • Create a network URL (or clear all documents from existing one from the previous test) that has no documents in Sort Work view (doesn't matter which filter we sort by)
// • Mock a student (in the same class with a teacher) - have them join the network(when they join the network a problem document is automatically created)
//   ↳ Next have the student place one tool on the document, lets say "Text"
//   ↳ As a teacher visit the Sort work view and select the "Sort by Tools" filter, verify that we should see that exact document under the "Text" section label.
//   ↳ Have the student remove the the Text tool on the document.
//   ↳ As a teacher again go back to the "Sort by Tools" filter, verify that we see the document under the "No Tools" section label - that is because the student removed the text tool.

describe('SortWorkView Tests', () => {
  it("should open Sort Work tab and test secondary sort functionality", () => {
    beforeTest(queryParams1);

    cy.get(".section-header-arrow").click({multiple: true}); // Open the sections
    cy.get("[data-testid=section-sub-header]").should("not.exist");
    cy.get("[data-testid=doc-group]").should("not.exist");
    cy.get("[data-testid=doc-group-label]").should("not.exist");
    cy.get("[data-testid=doc-group-list]").should("not.exist");

    // Switching from "Show for" from Problem to Investigation should switch the list of
    // documents from the larger thumbnail view to the smaller "simple" view and arrange the
    // document list items in rows that are potentially scrollable.
    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();
    cy.get("[data-testid=section-sub-header]").should("not.exist");
    cy.get("[data-testid=doc-group]").should("exist");
    // There should be one doc group per section-document-list. There is no
    // label for the doc group.
    cy.get("[data-testid=section-document-list]").each($el => {
      cy.wrap($el).find("[data-testid=doc-group]").should("have.length", 1);
      cy.wrap($el).find("[data-testid=doc-group-label]").should("not.exist");
    });
    cy.get("[data-testid=doc-group-list]").invoke("prop", "scrollLeft").should("be.eq", 0);
    cy.get("[data-testid=scroll-button-left]").should("exist").and("be.disabled");
    cy.get("[data-testid=scroll-button-right]").should("exist").and("not.be.disabled");
    cy.get("[data-testid=scroll-button-right]").click();
    cy.get("[data-testid=scroll-button-left]").should("exist").and("not.be.disabled");
    cy.get("[data-testid=doc-group-list]").invoke("prop", "scrollLeft").should("be.gt", 0);
    cy.get("[data-testid=scroll-button-left]").click();
    cy.get("[data-testid=scroll-button-left]").should("exist").and("be.disabled");
    cy.get("[data-testid=doc-group-list]").invoke("prop", "scrollLeft").should("be.eq", 0);

    // Apply secondary sort
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("exist");
    sortWork.getSecondarySortByTagOption().should("exist");
    sortWork.getSecondarySortByBookmarkedOption().should("exist");
    sortWork.getSecondarySortByToolsOption().should("exist");
    sortWork.getSecondarySortByNameOption().should("exist").click();
    sortWork.getSecondarySortByNoneOption().should("not.have.class", "selected");
    sortWork.getSecondarySortByNameOption().should("have.class", "selected");
    cy.get("[data-testid=section-sub-header]").each($el => {
      cy.wrap($el).should("exist").and("have.text", "Name");
    });
    cy.get("[data-testid=doc-group]").should("exist");
    // There should be multiple doc groups that are children of each section-document-list.
    // Each doc group should have its own label.
    cy.get("[data-testid=section-document-list]").each($el => {
      cy.wrap($el).find("[data-testid=doc-group]").should("have.length.be.greaterThan", 1).each($group => {
        cy.wrap($group).find("[data-testid=doc-group-label]").should("have.length", 1);
      });
    });

    // Change the primary sort option to match the currently-selected secondary sort option, and
    // make sure the latter automatically resets to "None", and the previously-selected option in
    // the primary menu is now selectable in the secondary sort menu.
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("have.class", "disabled");
    sortWork.getSecondarySortByNameOption().should("have.class", "selected");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByNameOption().click();
    sortWork.getPrimarySortByGroupOption().should("not.have.class", "selected");
    sortWork.getPrimarySortByNameOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("have.class", "enabled");
    sortWork.getSecondarySortByNameOption().should("not.have.class", "selected").and("have.class", "disabled");
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");

  });
});
