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
