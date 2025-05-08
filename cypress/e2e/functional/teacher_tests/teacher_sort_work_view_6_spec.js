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
  it("should retain selection state when going between sort options and viewing a sorted document", () => {
    beforeTest(queryParams1);

    cy.log("expand a section and verify that the section remains expanded after selecting a new secondary sort option");
    cy.get('.section-header-arrow').eq(1).click();
    cy.get('.section-header-arrow').eq(1).should("have.class", "up");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNameOption().click();
    sortWork.getSecondarySortByNameOption().should("have.class", "selected");
    cy.get('.section-header-arrow').eq(1).should("have.class", "up");

    cy.log("open a document and verify that the section remains expanded and the document is highlighted");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().click();
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");
    cy.get('.section-header-arrow').eq(1).should("have.class", "up");
    let prevFocusDocTitle = "";
    sortWork.getSortWorkItem().first().find('div').invoke('text').then((docText) => {
      prevFocusDocTitle = docText.trim();
    });
    sortWork.getSortWorkItem().first().click();
    cy.get('.close-doc-button').click();
    cy.get('.section-header-arrow').eq(1).should("have.class", "up");
    cy.get(".sort-work-view .sorted-sections .list-item").first().should("have.class", "selected");

    cy.log("change the secondary sort and verify that the section remains expanded and the document is highlighted");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNameOption().click();
    cy.get(".sort-work-view .sorted-sections .simple-document-item.selected")
      .should("exist")
      .invoke("attr", "title")
      .then((docTitle2) => {
        expect(docTitle2).to.equal(prevFocusDocTitle);
      });

    cy.log("when primary sort is switched, there should be no expanded sections, and no highlighted documents");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    cy.get('.section-header-arrow').should("not.have.class", "up");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().click();
    cy.get('.section-header-arrow').click({multiple: true});
    cy.get(".sort-work-view .sorted-sections .list-item").should("not.have.class", "selected");
  });
});
