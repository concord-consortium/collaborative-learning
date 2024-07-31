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
const queryParams2 = `${Cypress.config("qaConfigSubtabsUnitTeacher1")}`;

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  cy.openTopTab('sort-work');
  cy.wait(1000);
}

function runClueAsStudent(student, group = 5) {
  cy.visit(queryParams2.replace("teacher:1", student).replace("qaGroup=5", `qaGroup=${group}`));
  cy.waitForLoad();
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
  it('should open SortWorkView tab and interact with it', () => {
    beforeTest(queryParams1);
    cy.log('verify clicking the sort menu');
    sortWork.getPrimarySortByMenu().click(); // Open the sort menu
    cy.wait(1000);

    sortWork.getPrimarySortByNameOption().click(); //Select 'Name' sort type
    cy.wait(1000);

    sortWork.getPrimarySortByMenu().click(); // Open the sort menu again
    cy.wait(1000);

    sortWork.getPrimarySortByGroupOption().click(); // Select 'Group' sort type
    cy.wait(1000);

    cy.log('verify opening and closing a document from the sort work view');
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItem().eq(1).click(); // Open the first document in the list
    resourcesPanel.getEditableDocumentContent().should('be.visible');
    resourcesPanel.getDocumentCloseButton().click();
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItem().should('be.visible'); // Verify the document is closed
  });

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
    cy.wait(500);
    sortWork.getShowForInvestigationOption().click();
    cy.wait(500);
    // For the "Investigation", "Unit", and "All" options, documents should be listed using the smaller "simple" view
    cy.get("[data-test=sort-work-list-items]").should("not.exist");
    cy.get("[data-test=simple-document-item]").should("have.length.greaterThan", 0);
    sortWork.getShowForMenu().click();
    cy.wait(500);
    sortWork.getShowForUnitOption().click();
    cy.wait(500);
    cy.get("[data-test=sort-work-list-items]").should("not.exist");
    cy.get("[data-test=simple-document-item]").should("have.length.greaterThan", 0);
    sortWork.getShowForMenu().click();
    cy.wait(500);
    sortWork.getShowForAllOption().click();
    cy.wait(500);
    cy.get("[data-test=sort-work-list-items]").should("not.exist");
    cy.get("[data-test=simple-document-item]").should("have.length.greaterThan", 0);
    cy.get("[data-test=simple-document-item]").should("have.attr", "title").and("not.be.empty");
    cy.get("[data-test=simple-document-item]").first().click();
    sortWork.getFocusDocument().should("be.visible");
  });

  // TODO: Reinstate the tests below when all metadata documents have the new fields and are updated in real time.
  it.skip("should open Sort Work tab and test sorting by group", () => {
    // Clear data before the test so it can be retried and will start with a clean slate
    cy.clearQAData('all');

    const students = ["student:1", "student:2", "student:3", "student:4"];
    const studentProblemDocs = [
      `Student 1: ${title}`,
      `Student 2: ${title}`,
      `Student 3: ${title}`,
      `Student 4: ${title}`
    ];
    const studentPersonalDocs = [
      `Student 1: ${copyTitle}`,
      `Student 2: ${copyTitle}`,
      `Student 3: ${copyTitle}`,
      `Student 4: ${copyTitle}`
    ];
    const exemplarDocs = [
      `Ivan Idea: First Exemplar`
    ];

    cy.log("run CLUE for various students creating their problem and personal documents");
    students.forEach(student => {
      runClueAsStudent(student);
      canvas.copyDocument(copyTitle);
      canvas.getPersonalDocTitle().find('span').text().should('contain', copyTitle);
      // Check that exemplar is not visible to student
      cy.openTopTab('sort-work');
      cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
      sortWork.getSortWorkItemByTitle(exemplarDocs[0]).parents('.list-item').should("have.class", "private");
    });

    cy.log("run CLUE as teacher and check student problem, personal, and exemplar docs show in Sort Work");
    cy.visit(queryParams2);
    cy.waitForLoad();
    cy.openTopTab('sort-work');
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    cy.wait(1000);
    studentProblemDocs.forEach(doc => {
      sortWork.getSortWorkItem().should('contain', doc);
    });
    studentPersonalDocs.forEach(doc => {
      sortWork.getSortWorkItem().should('contain', doc);
    });

    cy.log("verify that exemplar document shows in Sort Work");
    sortWork.getSortWorkItem().should('contain', exemplarDocs[0]);

    cy.log("open problem doc and make sure Edit button doesn't show and Close button shows");
    sortWork.getSortWorkItem().contains(studentProblemDocs[0]).click();
    resourcesPanel.getDocumentEditButton().should("not.exist");
    resourcesPanel.getDocumentCloseButton().should("exist").click();

    cy.log("open personal doc and make sure Edit button doesn't show and Close button shows");
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItem().contains(studentPersonalDocs[0]).click();
    resourcesPanel.getDocumentEditButton().should("not.exist");
    resourcesPanel.getDocumentCloseButton().should("exist").click();

    cy.log("open exemplar doc and make sure Edit button doesn't show and Close button shows");
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItem().contains(exemplarDocs[0]).click();
    resourcesPanel.getDocumentEditButton().should("not.exist");
    resourcesPanel.getDocumentCloseButton().should("exist");

    cy.log("set exemplar to be visible to students");
    resourcesPanel.getExemplarShareCheckbox().should("not.be.checked");
    resourcesPanel.getExemplarShareCheckbox().check();
    resourcesPanel.getExemplarShareCheckbox().should("be.checked");
    resourcesPanel.getDocumentCloseButton().click();

    cy.log("check all problem and personal docs show in the correct group");
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    studentProblemDocs.forEach(doc => {
      sortWork.checkDocumentInGroup("Group 5", doc);
    });
    studentPersonalDocs.forEach(doc => {
      sortWork.checkDocumentInGroup("Group 5", doc);
    });

    cy.log("run CLUE as student 1; they should now have access to exemplar");
    runClueAsStudent(students[0]);
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItemByTitle(exemplarDocs[0]).parents('.list-item').should("not.have.class", "private");

    cy.log("have student 1 leave the group");
    header.leaveGroup();

    cy.log("check student:1 problem, exemplar, and personal docs show in No Group");
    cy.visit(queryParams2);
    cy.waitForLoad();
    cy.openTopTab('sort-work');
    cy.wait(1000);
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentNotInGroup("Group 5", studentProblemDocs[0]);
    sortWork.checkDocumentNotInGroup("Group 5", studentPersonalDocs[0]);
    sortWork.checkDocumentInGroup("No Group", studentProblemDocs[0]);
    sortWork.checkDocumentInGroup("No Group", studentPersonalDocs[0]);
    sortWork.checkDocumentInGroup("Group 5", studentProblemDocs[1]);
    sortWork.checkDocumentInGroup("Group 5", studentPersonalDocs[1]);
    sortWork.checkDocumentNotInGroup("No Group", studentProblemDocs[1]);
    sortWork.checkDocumentNotInGroup("No Group", studentPersonalDocs[1]);
    sortWork.checkDocumentInGroup("No Group", exemplarDocs[0]);

    cy.log("check that problem and exemplar documents can be sorted by name");
    sortWork.getPrimarySortByMenu().click();
    cy.wait(1000);
    sortWork.getPrimarySortByNameOption().click();
    sortWork.checkSectionHeaderLabelsExist([
      "1, Student", "1, Teacher", "2, Student", "3, Student", "4, Student", "Idea, Ivan"
    ]);
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Idea, Ivan", exemplarDocs[0]);
    sortWork.checkDocumentInGroup("1, Student", studentProblemDocs[0]);

    cy.log("check that exemplar document is displayed in strategy tag sourced from CMS");
    sortWork.getPrimarySortByMenu().click();
    cy.wait(1000);
    sortWork.getPrimarySortByTagOption().click();
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Unit Rate", exemplarDocs[0]);

    cy.log("check that exemplar document can also be assigned tag by teacher");
    sortWork.getSortWorkItem().contains(exemplarDocs[0]).click();
    chatPanel.getChatPanelToggle().click();
    chatPanel.addCommentTagAndVerify("Diverging Designs");

    cy.log("check that exemplar document is displayed in new tag");
    chatPanel.getChatCloseButton().click();
    cy.openTopTab('sort-work');
    // at the moment this is required to refresh the sort
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByNameOption().click();
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Diverging Designs", exemplarDocs[0]);

    cy.log("remove the teacher added tag and reload");
    sortWork.getSortWorkItem().contains(exemplarDocs[0]).click();
    chatPanel.getChatPanelToggle().click();
    chatPanel.deleteTeacherComments();
    cy.wait(1000);
    cy.visit(queryParams2);
    cy.waitForLoad();
    cy.openTopTab('sort-work');

    cy.log("check that exemplar document is still displayed in strategy tag sourced from CMS but not in teacher added tag");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Unit Rate", exemplarDocs[0]);
    sortWork.checkGroupIsEmpty("Diverging Designs");

    cy.log("run CLUE as a student:1 and join group 6");
    runClueAsStudent(students[0], 6);

    cy.log("check student:1 problem and personal docs show in Group 6");
    cy.visit(queryParams2);
    cy.waitForLoad();
    cy.openTopTab('sort-work');
    cy.wait(1000);
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Group 6", studentProblemDocs[0]);
    sortWork.checkDocumentInGroup("Group 6", studentPersonalDocs[0]);
    sortWork.checkDocumentInGroup("Group 5", studentProblemDocs[1]);
    sortWork.checkDocumentInGroup("Group 5", studentPersonalDocs[1]);
    sortWork.checkDocumentNotInGroup("Group 6", studentProblemDocs[1]);
    sortWork.checkDocumentNotInGroup("Group 6", studentPersonalDocs[1]);

    cy.log("run CLUE as a student:1 and leave the group");
    runClueAsStudent(students[0], 6);
    header.leaveGroup();

    cy.log("check Group 6 no longer exists in Sort Work");
    cy.visit(queryParams2);
    cy.waitForLoad();
    cy.openTopTab('sort-work');
    cy.wait(1000);
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("No Group", studentProblemDocs[0]);
    sortWork.checkDocumentInGroup("No Group", studentPersonalDocs[0]);
    sortWork.checkGroupDoesNotExist("Group 6");
  });
});
