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

// NOTE: this test file was split from the original teacher_sort_work_view_spec.js file into
// separate files for each test due to Cypress running out of memory when running all tests.

describe('SortWorkView Tests', () => {
  it("should open Sort Work tab and test showing by Problem, Investigation, Unit, All", () => {
    beforeTest(queryParams1);

    sortWork.getShowForMenu().should("be.visible");
    sortWork.getShowForProblemOption().should("have.class", "selected"); // "Problem" selected by default
    sortWork.getShowForInvestigationOption().should("exist");
    sortWork.getShowForUnitOption().should("exist");
    sortWork.getShowForAllOption().should("exist");

    cy.get(".section-header-arrow").click({multiple: true}); // Open the sections
    // For the "Problem" option, documents should be listed using the larger thumbnail view
    cy.get("[data-test=sort-work-list-items]").should("have.length.greaterThan", 0);
    cy.get("[data-test=simple-document-item]").should("not.exist");
    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();
    // For the "Investigation", "Unit", and "All" options, documents should be listed using the smaller "simple" view
    cy.get("[data-test=sort-work-list-items]").should("not.exist");
    cy.get("[data-test=simple-document-item]").should("have.length.greaterThan", 0);
    sortWork.getShowForMenu().click();
    sortWork.getShowForUnitOption().click();
    cy.get("[data-test=sort-work-list-items]").should("not.exist");
    cy.get("[data-test=simple-document-item]").should("have.length.greaterThan", 0);
    sortWork.getShowForMenu().click();
    sortWork.getShowForAllOption().click();
    cy.get("[data-test=sort-work-list-items]").should("not.exist");
    cy.get("[data-test=simple-document-item]").should("have.length.greaterThan", 0);
    cy.get("[data-test=simple-document-item]").should("have.attr", "title").and("not.be.empty");
    cy.get("[data-test=simple-document-item]").first().click();
    sortWork.getFocusDocument().should("be.visible");
  });
});
