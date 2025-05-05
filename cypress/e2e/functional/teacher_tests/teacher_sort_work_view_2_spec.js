import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import Canvas from '../../../support/elements/common/Canvas';
import ClueHeader from '../../../support/elements/common/cHeader';
import ChatPanel from "../../../support/elements/common/ChatPanel";

let sortWork = new SortedWork;
let resourcesPanel = new ResourcesPanel;
let dashboard = new TeacherDashboard;
let header = new ClueHeader;
let chatPanel = new ChatPanel;

const canvas = new Canvas;
const title = "1.1 Unit Toolbar Configuration";
const copyTitle = "Personal Workspace";
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
