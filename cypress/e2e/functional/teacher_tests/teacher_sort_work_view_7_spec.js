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
  it("should show the selected sort options when viewing a document within the Sort Work tab and the document scroller is visible", () => {
    beforeTest(queryParams1);

    cy.log("open a document and verify that the selected sort options are displayed in the header");
    cy.get('.section-header-arrow').eq(0).click();
    sortWork.getSortWorkItem().first().click();
    cy.get('.document-scroller-header').should("exist");
    cy.get('.document-scroller-header').find('.header-text').eq(0).should("contain", "Sorted by");
    cy.get('.document-scroller-header').find('.header-text').eq(0).find("span").should("contain", "Group / None");
    cy.get('.document-scroller-header').find('.header-text').eq(1).should("contain", "Shown for");
    cy.get('.document-scroller-header').find('.header-text').eq(1).find("span").should("contain", "Problem");

    cy.log("change the selected sort options and verify that the header text is updated");
    cy.get('.close-doc-button').click();
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNameOption().click();
    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();
    cy.get('.section-header-arrow').click({multiple: true});
    cy.get(".sort-work-view .sorted-sections .simple-document-item").first().click();
    cy.get('.document-scroller-header').find('.header-text').eq(0).find("span").should("contain", "Strategy / Name");
    cy.get('.document-scroller-header').find('.header-text').eq(1).find("span").should("contain", "Investigation");

    cy.log("toggle the document scroller and verify that the selected sort options are not displayed");
    cy.get('[data-testid="toggle-document-scroller"]').click();
    cy.get('.document-scroller-header').should("not.exist");

    cy.log("toggle the document scroller back on and verify that the selected sort options are displayed again");
    cy.get('[data-testid="toggle-document-scroller"]').click();
    cy.get('.document-scroller-header').should("exist");
    cy.get('.document-scroller-header').find('.header-text').eq(0).find("span").should("contain", "Strategy / Name");
    cy.get('.document-scroller-header').find('.header-text').eq(1).find("span").should("contain", "Investigation");
  });
});
