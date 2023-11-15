import ChatPanel from "../../../../support/elements/clue/ChatPanel";
import TeacherNetwork from "../../../../support/elements/clue/TeacherNetwork";
import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
/**
 * Notes:
 *
 * Teacher dashboard test needs static data from 'clueteachertest's class 'CLUE'
 * Here is the ID for the class in firebase: a1f7b8f8b7b1ad1d2d6240c41bd2354d8575ee09ae8bd641
 *
 * Currently issues with problem switcher/class switcher. Maybe split these into two tests. Have this test
 * log into portal with data that doesn't need to be static.
 *
 * -> This may also help with issue when verifying read-only student canvases which is currently looping through
 *    all of the students in the dashboard's current view
 */

let chatPanel = new ChatPanel;
let teacherNetwork = new TeacherNetwork;
let dashboard = new TeacherDashboard();

const portalUrl = "https://learn.portal.staging.concord.org";
const offeringId1 = "221";
const offeringId2 = "226";
const reportUrl1 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId1 + "/external_report/11";
const reportUrl2 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId2 + "/external_report/11";
const clueTeacher1 = {
  username: "clueteachertest1",
  password: "password",
  firstname: "Clue",
  lastname: "Teacher1"
};
const clueTeacher2 = {
  username: "clueteachertest2",
  password: "password",
  firstname: "Clue",
  lastname: "Teacher2"
};
const classInfo1 = clueTeacher1.firstname + ' ' + clueTeacher1.lastname + ' / CLUE';
const workDoc = 'SAS 1.1 Solving a Mystery with Proportional Reasoning';
const classInfo2 = clueTeacher2.firstname + ' ' + clueTeacher2.lastname + ' / CLUE';
const planningDoc = 'SAS 1.1 Solving a Mystery with Proportional Reasoning: Planning';
const teacher1ProblemComment = "This is a teacher1 working document comment " + Math.random();
const teacher1PlanningComment = "This is a teacher1 planning document comment " + Math.random();
const teacher2ProblemComment = "This is teacher2's comment on teacher1's working document " + Math.random();
const teacher2PlanningComment = "This is teacher2's comment on teacher1's planning document " + Math.random();


function beforeTest(portalUrl, clueTeacher, reportUrl) {
  cy.login(portalUrl, clueTeacher);
  cy.launchReport(reportUrl);
  cy.waitForLoad();
  chatPanel.getChatPanelToggle().click();
  chatPanel.getChatPanel().should("be.visible");
  cy.openTopTab("my-work");
  cy.openSection('my-work', 'workspaces');
}

describe('Teachers can communicate back and forth in chat panel', () => {
  // TODO: Re-instate the skipped tests below once learn.staging.concord.org is fully functional again
  it('teachers can communicate back and forth in chat panel', () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);

    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.verifyDocumentsListDisplays('workspaces', 'my-classes', classInfo1);
    teacherNetwork.verifyDocumentName('workspaces', 'my-classes', classInfo1, workDoc);
    teacherNetwork.verifyDocumentName('workspaces', 'my-classes', classInfo1, planningDoc);
    
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, workDoc);
    cy.wait(1000);
    chatPanel.addDocumentCommentAndVerify(teacher1ProblemComment);

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, planningDoc);
    cy.wait(1000);
    chatPanel.addDocumentCommentAndVerify(teacher1PlanningComment);

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo2);
    teacherNetwork.verifyDocumentsListDisplays('workspaces', 'my-network', classInfo2);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo2, workDoc);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo2, planningDoc);
    teacherNetwork.collapseSectionClass('workspaces', 'my-network', classInfo2);
    
    cy.log("login teacher2 and setup clue chat");
    cy.logout(portalUrl);
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, workDoc);
    cy.wait(1000);
    chatPanel.verifyCommentThreadContains(teacher1ProblemComment);
    chatPanel.addDocumentCommentAndVerify(teacher2ProblemComment);

    chatPanel.getDeleteMessageButtonForUser("Clue Teacher1").should("not.exist");
    chatPanel.getDeleteMessageButton(teacher2ProblemComment).click();
    chatPanel.getDeleteConfirmModalButton().click();
    chatPanel.getFocusedThread().should("not.contain", teacher2ProblemComment);

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, planningDoc);
    cy.wait(1000);
    chatPanel.verifyCommentThreadContains(teacher1PlanningComment);
    chatPanel.addDocumentCommentAndVerify(teacher2PlanningComment);

    chatPanel.getDeleteMessageButtonForUser("Clue Teacher1").should("not.exist");
    chatPanel.getDeleteMessageButton(teacher2PlanningComment).click();
    chatPanel.getDeleteConfirmModalButton().click();
    chatPanel.getFocusedThread().should("not.contain", teacher2PlanningComment);
  });
});
