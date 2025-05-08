import SortedWork from "../../../support/elements/common/SortedWork";
import { visitQaSubtabsUnit } from "../../../support/visit_params";

let sortWork = new SortedWork;

// NOTE: this test file was split from the original teacher_sort_work_view_spec.js file into
// separate files for each test due to Cypress running out of memory when running all tests.

describe('SortWorkView Tests', () => {
  it("should open Sort Work tab and test that sort selections persist", () => {
    visitQaSubtabsUnit({teacher: 1});
    cy.openTopTab('sort-work');

    cy.log("check initial state of primary and secondary sort selections and modify both");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");
    sortWork.getPrimarySortByNameOption().click();
    sortWork.getPrimarySortByNameOption().should("have.class", "selected");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().click();
    sortWork.getSecondarySortByGroupOption().should("have.class", "selected");
    // Give CLUE some time to save the changes
    cy.wait(500);

    cy.log("reload page and check that modified sort selections persist");
    visitQaSubtabsUnit({teacher: 1});
    cy.waitForLoad();
    cy.openTopTab("sort-work");
    sortWork.getPrimarySortByNameOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("have.class", "selected");
  });
});
