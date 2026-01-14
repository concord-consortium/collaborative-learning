import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import SortedWork from "../../../support/elements/common/SortedWork";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";

let sortWork = new SortedWork;
let resourcesPanel = new ResourcesPanel;
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

//TODO: For QA (1/24)
// Write a test that confirms correct behavior for "Sort by Tools"
// • Create a network URL (or clear all documents from existing one from the previous test) that has no documents in Sort Work view (doesn't matter which filter we sort by)
// • Mock a student (in the same class with a teacher) - have them join the network(when they join the network a problem document is automatically created)
//   ↳ Next have the student place one tool on the document, lets say "Text"
//   ↳ As a teacher visit the Sort work view and select the "Sort by Tools" filter, verify that we should see that exact document under the "Text" section label.
//   ↳ Have the student remove the the Text tool on the document.
//   ↳ As a teacher again go back to the "Sort by Tools" filter, verify that we see the document under the "No Tools" section label - that is because the student removed the text tool.

describe('SortWorkView Tests', () => {
  it('should open SortWorkView tab and interact with it', () => {
    beforeTest(queryParams1);
    cy.log('verify clicking the sort menu');
    sortWork.getPrimarySortByMenu().click(); // Open the sort menu
    cy.wait(500);
    sortWork.getPrimarySortByNameOption().click(); //Select 'Name' sort type
    cy.wait(500);
    sortWork.getPrimarySortByMenu().click(); // Open the sort menu again
    cy.wait(500);
    sortWork.getPrimarySortByGroupOption().click(); // Select 'Group' sort type
    cy.wait(500);

    cy.log('verify opening and closing a document from the sort work view');
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItem().eq(1).click(); // Open the first document in the list
    resourcesPanel.getEditableDocumentContent().should('be.visible');

    cy.log('verify can switch sort groups using arrows');
    cy.get('.header-text').should('not.contain.text', 'Group 1');
    cy.get('.header-text').should('contain.text', 'No Group');
    cy.get('.switch-sort-group-button.left').click();
    cy.get('.header-text').should('not.contain.text', 'No Group');
    cy.get('.header-text').should('contain.text', 'Group 1');
    cy.get('.switch-sort-group-button.left').click();
    cy.get('.header-text').should('not.contain.text', 'Group 1');
    cy.get('.header-text').should('contain.text', 'No Group');
    cy.get('.switch-sort-group-button.right').click();
    cy.get('.header-text').should('not.contain.text', 'No Group');
    cy.get('.header-text').should('contain.text', 'Group 1');
    cy.get('.switch-sort-group-button.right').click();
    cy.get('.header-text').should('not.contain.text', 'Group 1');
    cy.get('.header-text').should('contain.text', 'No Group');

    cy.log('verify thumbnail view options work');
    cy.get('.thumbnail-display-button.small-thumbnails.selected').should('exist');
    cy.get('.thumbnail-display-button.large-thumbnails.selected').should('not.exist');
    cy.get('.nav-tab-panel .full-screen-editable-document-content').should('exist');
    cy.get('.document-thumbnail-scroller.large-thumbnails').should('not.exist');
    cy.contains('Student 7: My First Learning Log').should('be.visible');
    cy.get('.thumbnail-display-button.large-thumbnails').click();
    cy.get('.thumbnail-display-button.small-thumbnails.selected').should('not.exist');
    cy.get('.thumbnail-display-button.large-thumbnails.selected').should('exist');
    cy.get('.nav-tab-panel .full-screen-editable-document-content').should('not.exist');
    cy.get('.document-thumbnail-scroller.large-thumbnails').should('exist');
    cy.contains('Student 7: My First Learning Log').should('not.be.visible');
    cy.get('.thumbnail-display-button.small-thumbnails').click();

    cy.log('verify document scroller is visible, populated, and functions');
    let prevFocusDocKey = "";
    let selectedDocIndex = 0;
    resourcesPanel.getEditableDocumentContent().invoke('attr', 'data-focus-document').then((focusDocKey) => {
      prevFocusDocKey = focusDocKey;
    });
    resourcesPanel.getDocumentScroller().should('be.visible').and($el => {
      expect($el.find('[data-testid="document-thumbnail"]')).to.have.length.greaterThan(1);
      expect($el.find('[data-testid="document-thumbnail"].selected')).to.have.length(1);
      selectedDocIndex = $el.find('[data-testid="document-thumbnail"]')
                         .index($el.find('[data-testid="document-thumbnail"].selected'));
    });
    resourcesPanel.getDocumentScrollerLeftBtn().should('not.exist');
    cy.get('[data-testid="document-thumbnail"]').first().should('be.visible');
    resourcesPanel.getDocumentScrollerRightBtn().should('exist').click();
    cy.get('[data-testid="document-thumbnail"]').first().should('not.be.visible');
    resourcesPanel.getDocumentScrollerLeftBtn().should('exist').click();
    cy.get('[data-testid="document-thumbnail"]').first().should('be.visible');
    cy.get('[data-testid="document-thumbnail"]').eq(selectedDocIndex + 1).click();
    resourcesPanel.getEditableDocumentContent().invoke('attr', 'data-focus-document')
                                               .should('not.eq', prevFocusDocKey).then((focusDocKey) => {
                                                 prevFocusDocKey = focusDocKey;
                                               });

    cy.log('verify document scroller is collapsible, and that switch document buttons appear when it is collapsed');
    resourcesPanel.getDocumentSwitchBtnPrev().should('not.exist');
    resourcesPanel.getDocumentSwitchBtnNext().should('not.exist');
    resourcesPanel.getDocumentScrollerToggle().should('exist').click();
    resourcesPanel.getDocumentScroller().should('not.exist');
    resourcesPanel.getDocumentSwitchBtnPrev().should('exist').and('not.have.class', 'disabled').click();
    resourcesPanel.getDocumentSwitchBtnPrev().should('have.class', 'disabled');
    resourcesPanel.getEditableDocumentContent().invoke('attr', 'data-focus-document')
                                               .should('not.eq', prevFocusDocKey);
    resourcesPanel.getDocumentSwitchBtnNext().should('exist').and('not.have.class', 'disabled');

    resourcesPanel.getDocumentCloseButton().click();
    sortWork.getSortWorkItem().should('be.visible'); // Verify the document is closed
  });
});
