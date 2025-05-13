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
  it("shows the current sort selections in the document-scroller header", () => {
    beforeTest(queryParams1);

    cy.log("open a document and verify the initial header");

    cy.get('.section-header-arrow').first().click();
    sortWork.getPrimarySortLabelForItem(0)
      .invoke('text')
      .then((primaryLabel) => {

        // open the first document under that sort category
        sortWork.getSortWorkItem().first().click();

        /* header exists and shows the expected strings */
        cy.get('.document-scroller-header').should('exist');

        sortWork.getHeaderTexts().eq(0)
          .should('contain', 'Sorted by')
          .find('span').should('contain', 'Group')
          .parent().should('not.contain', 'None') // don't show "None" in the header
          .should('contain', primaryLabel);      // dynamic bit

          sortWork.getHeaderTexts().eq(1)
            .should('contain', 'Shown for')
            .find('span').should('contain', 'Problem');
      }
    );

    cy.log("change sort selections and verify header update");

    cy.get('.close-doc-button').click();
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNameOption().click();
    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();

    cy.get('.section-header-arrow').click({ multiple: true });
    // capture the text of the first “Primary Sort By” pill
    sortWork.getPrimarySortLabelForItem(0, true)
      .invoke('text')
      .then((primaryLabel) => {

        sortWork.getSecondarySortLabelForItem(0)
          .invoke('text')
          .then((secondaryLabel) => {

            // open the first document under that sort category
            sortWork.getSimpleDocumentItem().first().click();

            /* header exists and shows the expected strings */
            cy.get('.document-scroller-header').should('exist');

            sortWork.getHeaderTexts().eq(0)
              .should('contain', 'Sorted by')
              .find('span').eq(0).should('contain', 'Strategy')
              .parent().should('contain', primaryLabel)
              .find('span').eq(1).should('contain', 'Name')
              .parent().should('contain', secondaryLabel);

              sortWork.getHeaderTexts().eq(1)
                .should('contain', 'Shown for')
                .find('span').should('contain', 'Investigation');
          }
        );
      }
    );

    cy.log("toggle document scroller visibility");

    cy.get('[data-testid="toggle-document-scroller"]').click();
    cy.get('.document-scroller-header').should('not.exist');
    cy.get('[data-testid="toggle-document-scroller"]').click();
    cy.get('.document-scroller-header').should('exist');
  });
});
