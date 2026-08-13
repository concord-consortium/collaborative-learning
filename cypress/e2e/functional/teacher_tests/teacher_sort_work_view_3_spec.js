import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";
import { getSettledProp } from "../../../support/helpers/settled";

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
    // The Investigation layout renders one set of scroll buttons per section-document-list, and only
    // for a section whose documents overflow the row, so scope the scroll-behavior assertions to the
    // "No Group" section — the one large enough to scroll — to avoid multi-element subjects on `.click()`.
    sortWork.getSortWorkGroup("No Group").find("[data-testid=section-document-list]").within(() => {
      // The row scrolls smoothly, and narrows once the scroll buttons take their place beside it —
      // which is also what sets how far one click scrolls. Read both only once they hold still, or a
      // click lands part-way through a scroll, or on a row about to be a different width.
      const docRow = "[data-testid=doc-group-list]";
      getSettledProp(docRow, "clientWidth").should("be.gt", 0);
      getSettledProp(docRow, "scrollLeft").should("be.eq", 0);
      cy.get("[data-testid=scroll-button-left]").should("exist").and("be.disabled");
      cy.get("[data-testid=scroll-button-right]").should("exist").and("not.be.disabled");
      cy.get("[data-testid=scroll-button-right]").click();
      getSettledProp(docRow, "scrollLeft").should("be.gt", 0);
      cy.get("[data-testid=scroll-button-left]").should("exist").and("not.be.disabled");
      cy.get("[data-testid=scroll-button-left]").click();
      getSettledProp(docRow, "scrollLeft").should("be.eq", 0);
      cy.get("[data-testid=scroll-button-left]").should("exist").and("be.disabled");
    });

    // Apply secondary sort
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("exist");
    sortWork.getSecondarySortByTagOption().should("exist");
    sortWork.getSecondarySortByBookmarkedOption().should("exist");
    sortWork.getSecondarySortByToolsOption().should("exist");
    sortWork.getSecondarySortByDateOption().should("exist");
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

    cy.log('verify can switch groups sorted by two means using arrows');
    // Open a document in the "No Group" section, the only one holding enough documents to be split
    // across more than one name sub-group for the arrows to move between.
    sortWork.getSimpleDocumentGroupItem("No Group").eq(1).click();
    cy.get('.header-text').should('not.contain.text', '1, Teacher');
    cy.get('.header-text').should('contain.text', '10, Student');
    cy.get('.switch-sort-group-button.left').click();
    cy.get('.header-text').should('not.contain.text', '10, Student');
    cy.get('.header-text').should('contain.text', '1, Teacher');
    cy.get('.switch-sort-group-button.right').click();
    cy.get('.header-text').should('not.contain.text', '1, Teacher');
    cy.get('.header-text').should('contain.text', '10, Student');
    cy.get('.tab-sort-work').click();

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
