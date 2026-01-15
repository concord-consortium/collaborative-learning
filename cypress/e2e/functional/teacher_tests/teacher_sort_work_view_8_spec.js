import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";

let sortWork = new SortedWork();
let dashboard = new TeacherDashboard();

const queryParams1 = `${Cypress.config("clueTestqaConfigSubtabsUnitTeacher6")}`;

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  cy.openTopTab("sort-work");
  cy.wait(1000);
}

// NOTE: this test file is separate from the other teacher_sort_work_view_spec_n.js files
// separate files due to Cypress running out of memory when running all tests.

describe("SortWorkView Tests", () => {
  it("allows documents to be sorted by date as primary sort option", () => {
    beforeTest(queryParams1);

    cy.log("verify Date option exists in primary sort menu");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");
    sortWork.getPrimarySortByDateOption().should("exist");
    sortWork.getPrimarySortByDateOption().click();
    sortWork.getPrimarySortByDateOption().should("have.class", "selected");
    sortWork.getPrimarySortByGroupOption().should("not.have.class", "selected");

    cy.log("verify documents are organized by date when Date sort is applied");
    cy.get(".section-header-arrow").click({multiple: true}); // Open the sections
    cy.get(".section-header-label").should("exist");
    // Verify that section headers contain dates and are in descending chronological order
    cy.get(".section-header-label").then($headers => {
      const headerTexts = Array.from($headers).map(el => el.textContent);
      expect(headerTexts.length).to.be.greaterThan(0);
      // Headers should contain dates like "Wednesday, Jan 15, 2026" or "No Date"
      const daysOfWeek = "(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)";
      const months = "(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
      const dateRegex = new RegExp(`^\\s*((${daysOfWeek}, ${months} \\d{1,2}, \\d{4})|No Date)`);
      headerTexts.forEach(headerText => {
        expect(headerText).to.match(dateRegex);
      });

      cy.log("verify dates are in descending chronological order, with \"No Date\" section last.");
      if (headerTexts.length > 1) {
        const dates = headerTexts.map(headerText => {
          if (headerText.includes("No Date")) {
            return { isNoDate: true, date: new Date(0) };
          }
          const dateMatch = headerText.match(new RegExp(`${months} \\d{1,2}, \\d{4}`));
          if (dateMatch) {
            return { isNoDate: false, date: new Date(dateMatch[0]) };
          }
          return null;
        }).filter(item => item !== null);

        for (let i = 0; i < dates.length - 1; i++) {
          // Compare actual dates only when both entries have real dates
          if (!dates[i].isNoDate && !dates[i + 1].isNoDate) {
            expect(dates[i].date.getTime()).to.be.at.least(dates[i + 1].date.getTime());
          }
        }

        // Validate "No Date" group: should be exactly one group at the very end
        const noDateCount = dates.filter(item => item.isNoDate).length;
        if (noDateCount > 0) {
          expect(noDateCount).to.equal(1);
          expect(dates[dates.length - 1].isNoDate).to.be.true;
        }
      }
    });

    cy.log("verify switching from Date to other primary sort options works");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByNameOption().click();
    sortWork.getPrimarySortByNameOption().should("have.class", "selected");
    sortWork.getPrimarySortByDateOption().should("not.have.class", "selected");

    cy.log("verify switching back to Date sort works");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByDateOption().click();
    sortWork.getPrimarySortByDateOption().should("have.class", "selected");

    cy.log("verify Date sort persists when opening and closing documents");
    cy.get(".section-header-arrow").click({multiple: true}); // Open sections
    sortWork.getSortWorkItem().first().click();
    cy.get(".close-doc-button").click();
    sortWork.getPrimarySortByDateOption().should("have.class", "selected");
  });

  it("properly handles Date as primary sort with secondary sort interactions", () => {
    beforeTest(queryParams1);

    cy.log("set primary sort to Date and test secondary sort compatibility");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByDateOption().click();

    cy.log("verify secondary sort options are available when primary is Date");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByNoneOption().should("have.class", "selected");
    sortWork.getSecondarySortByGroupOption().should("exist").and("have.class", "enabled");
    sortWork.getSecondarySortByTagOption().should("exist").and("have.class", "enabled");
    sortWork.getSecondarySortByNameOption().should("exist").and("have.class", "enabled");
    sortWork.getSecondarySortByDateOption().should("have.class", "disabled"); // Should be disabled when primary is Date

    cy.log("apply secondary sort by Name when primary is Date");
    sortWork.getSecondarySortByNameOption().click();
    sortWork.getSecondarySortByNameOption().should("have.class", "selected");

    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();

    cy.get("[data-testid=section-sub-header]").each($el => {
      cy.wrap($el).should("exist").and("have.text", "Name");
    });

    cy.log("verify switching primary sort from Date enables Date in secondary");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().click();

    sortWork.getSecondarySortByDateOption().should("have.class", "enabled");
    sortWork.getSecondarySortByGroupOption().should("have.class", "disabled");
  });

  it("allows documents to be sorted with date as secondary sort option", () => {
    beforeTest(queryParams1);

    cy.log("set primary sort to Group");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().click();
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");

    cy.log("set secondary sort to Date");
    sortWork.getSecondarySortByDateOption().should("not.have.class", "selected");
    sortWork.getSecondarySortByMenu().click();
    sortWork.getSecondarySortByDateOption().click();
    sortWork.getSecondarySortByDateOption().should("have.class", "selected");
    cy.get("[data-testid=section-sub-header]").each($el => {
      cy.wrap($el).should("exist").and("have.text", "Date");
    });
    sortWork.getPrimarySortByGroupOption().should("have.class", "selected");
  });
});
