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
