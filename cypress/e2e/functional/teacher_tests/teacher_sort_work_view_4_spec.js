import SortedWork from "../../../support/elements/common/SortedWork";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import Canvas from '../../../support/elements/common/Canvas';
import ClueHeader from '../../../support/elements/common/cHeader';
import ChatPanel from "../../../support/elements/common/ChatPanel";
import { visitQaSubtabsUnit } from "../../../support/visit_params";

let sortWork = new SortedWork;
let resourcesPanel = new ResourcesPanel;
let header = new ClueHeader;
let chatPanel = new ChatPanel;

const canvas = new Canvas;
const title = "1.1 Unit Toolbar Configuration";
const copyTitle = "Personal Workspace";

// NOTE: this test file was split from the original teacher_sort_work_view_spec.js file into
// separate files for each test due to Cypress running out of memory when running all tests.

describe('SortWorkView Tests', () => {
  it("should open Sort Work tab and test sorting by group", () => {
    const students = [1,2,3];
    const studentProblemDocs = [
      `Student 1: ${title}`,
      `Student 2: ${title}`,
      `Student 3: ${title}`
    ];
    const studentPersonalDocs = [
      `Student 1: ${copyTitle}`,
      `Student 2: ${copyTitle}`,
      `Student 3: ${copyTitle}`
    ];
    const exemplarDocs = [
      `Ivan Idea: First Exemplar`
    ];

    cy.log("run CLUE for various students creating their problem and personal documents");
    students.forEach(student => {
      visitQaSubtabsUnit({student, group: 5});
      canvas.copyDocument(copyTitle);
      canvas.getPersonalDocTitle().find('span').text().should('contain', copyTitle);
      // Check that exemplar is not visible to student
      cy.openTopTab('sort-work');
      cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
      sortWork.getSortWorkItemByTitle(exemplarDocs[0]).parents('.list-item').should("have.class", "private");
    });

    cy.log("run CLUE as teacher and check student problem, personal, and exemplar docs show in Sort Work");
    visitQaSubtabsUnit({teacher: 1});
    cy.openTopTab('sort-work');
    cy.get('.section-header-label').should("contain", "Group 5");
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
    sortWork.getSortWorkItem().contains(studentPersonalDocs[0]).click();
    resourcesPanel.getDocumentEditButton().should("not.exist");
    resourcesPanel.getDocumentCloseButton().should("exist").click();

    cy.log("open exemplar doc and make sure Edit button doesn't show and Close button shows");
    sortWork.getSortWorkItem().contains(exemplarDocs[0]).click();
    resourcesPanel.getDocumentEditButton().should("not.exist");
    resourcesPanel.getDocumentCloseButton().should("exist");

    cy.log("set exemplar to be visible to students");
    resourcesPanel.getExemplarShareCheckbox().should("not.be.checked");
    resourcesPanel.getExemplarShareCheckbox().check();
    resourcesPanel.getExemplarShareCheckbox().should("be.checked");
    resourcesPanel.getDocumentCloseButton().click();

    cy.log("check all problem and personal docs show in the correct group");
    studentProblemDocs.forEach(doc => {
      sortWork.checkDocumentInGroup("Group 5", doc);
    });
    studentPersonalDocs.forEach(doc => {
      sortWork.checkDocumentInGroup("Group 5", doc);
    });

    cy.log("run CLUE as student 1; they should now have access to exemplar");
    visitQaSubtabsUnit({student: 1, group: 5});
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.getSortWorkItemByTitle(exemplarDocs[0]).parents('.list-item').should("not.have.class", "private");

    cy.log("have student 1 leave the group");
    header.leaveGroup();

    cy.log("check student:1 problem, exemplar, and personal docs show in No Group");
    visitQaSubtabsUnit({teacher: 1});
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
      "1, Student", "1, Teacher", "2, Student", "3, Student", "Idea, Ivan"
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
    // FIXME: at the moment it is necessary to comment the document twice.
    // Search for "exemplar" in document-comment-hooks.ts for an explanation.
    cy.wait(100);
    chatPanel.addCommentTagAndVerify("Diverging Designs");

    cy.log("check that exemplar document is displayed in new tag");
    chatPanel.getChatCloseButton().click();
    cy.openTopTab('sort-work');

    sortWork.checkDocumentInGroup("Diverging Designs", exemplarDocs[0]);

    cy.log("remove the teacher added tag and reload");
    sortWork.getSortWorkItem().contains(exemplarDocs[0]).click();
    chatPanel.getChatPanelToggle().click();
    chatPanel.deleteTeacherComments();
    cy.wait(1000);
    visitQaSubtabsUnit({teacher: 1});
    cy.openTopTab('sort-work');

    cy.log("check that exemplar document is still displayed in strategy tag sourced from CMS but not in teacher added tag");
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByTagOption().click();
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Unit Rate", exemplarDocs[0]);

    sortWork.checkGroupIsEmpty("Diverging Designs");

    cy.log("run CLUE as a student:1 and join group 6");
    visitQaSubtabsUnit({student: 1, group: 6});

    cy.log("check student:1 problem and personal docs show in Group 6");
    visitQaSubtabsUnit({teacher: 1});
    cy.openTopTab('sort-work');
    cy.wait(500);
    sortWork.getPrimarySortByMenu().click();
    sortWork.getPrimarySortByGroupOption().click();
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("Group 6", studentProblemDocs[0]);
    sortWork.checkDocumentInGroup("Group 6", studentPersonalDocs[0]);
    sortWork.checkDocumentInGroup("Group 5", studentProblemDocs[1]);
    sortWork.checkDocumentInGroup("Group 5", studentPersonalDocs[1]);
    sortWork.checkDocumentNotInGroup("Group 6", studentProblemDocs[1]);
    sortWork.checkDocumentNotInGroup("Group 6", studentPersonalDocs[1]);

    cy.log("run CLUE as a student:1 and leave the group");
    visitQaSubtabsUnit({student: 1, group: 6});
    header.leaveGroup();

    cy.log("check Group 6 no longer exists in Sort Work");
    visitQaSubtabsUnit({teacher: 1});
    cy.openTopTab('sort-work');
    cy.wait(500);
    cy.get('.section-header-arrow').click({multiple: true}); // Open the sections
    sortWork.checkDocumentInGroup("No Group", studentProblemDocs[0]);
    sortWork.checkDocumentInGroup("No Group", studentPersonalDocs[0]);
    sortWork.checkGroupDoesNotExist("Group 6");
  });
});
