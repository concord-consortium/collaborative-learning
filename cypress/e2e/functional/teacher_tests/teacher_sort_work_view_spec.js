import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";

let dashboard = new TeacherDashboard();
const sortWorkItem = '.sort-work-view .sorted-sections .list-item';

function beforeTest() {
  const queryParams = "/?appMode=demo&demoName=CLUE-Test&fakeClass=1&fakeOffering=1&problem=1.1&fakeUser=teacher:1&unit=example-config-subtabs&curriculumBranch=sort-tab-dev-3&noPersistentUI";
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  cy.openTopTab('sort-work');
  cy.wait(1000);
}

//TODO: For QA
// • Mock a student in the same class - have them join a group - once they've joined they should have a default problem document, Verify the teacher sees this
//   ↳ Click on that document, verify it opens.
//   ↳ Verify that document does not have an "Edit Button" - since only owners of a document should be able to see the edit button (i.e. if its teacher 1 - they can only edit teacher 1 documents)

// • Have that student make a personal document. Verify the teacher sees this personal document.
//   ↳ Click on that document, verify it opens.

// • Have that student join another group, verify the teacher sees the student move between groups.
//   ↳Verify the teacher sees the previous group disappear
//   ↳Verify that the teacher sees the new group disappear
// Note that even though the group would disappear, the personal and problem documents would still exist but will be in the "No Group" section - I don't think you necessarily need to test this

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
    beforeTest();
    cy.log('verify clicking the sort menu');
    cy.get('.custom-select.sort-work-sort-menu').click(); // Open the sort menu
    cy.wait(1000);

    cy.get('[data-test="list-item-name"]').click(); //Select 'Name' sort type
    cy.wait(1000);

    cy.get('.custom-select.sort-work-sort-menu').click(); // Open the sort menu again
    cy.wait(1000);

    cy.get('[data-test="list-item-group"]').click(); // Select 'Group' sort type
    cy.wait(1000);
  });
  it('should open a document from the SortWorkView tab', () => {
    beforeTest();
    cy.log('verify opening and closing a document from the sort work view');
    cy.get(sortWorkItem).eq(1).click(); // Open the first document in the list
    cy.get('.document-content').should('be.visible');
    cy.get('.document-buttons .close-doc-button').click();
    cy.get(sortWorkItem).should('be.visible'); // Verify the document is closed
  });
});


