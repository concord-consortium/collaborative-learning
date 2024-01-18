import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";

let dashboard = new TeacherDashboard();

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
});
