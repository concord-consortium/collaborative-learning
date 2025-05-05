import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import Canvas from '../../../support/elements/common/Canvas';
import ClueHeader from '../../../support/elements/common/cHeader';
import ChatPanel from "../../../support/elements/common/ChatPanel";
import { visitQaSubtabsUnit } from "../../../support/visit_params";

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
