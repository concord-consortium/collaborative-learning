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
const classInfo2 = clueTeacher2.firstname + ' ' + clueTeacher2.lastname + ' / CLUE Teacher 2';
const planningDoc = 'SAS 1.1 Solving a Mystery with Proportional Reasoning: Planning';

function beforeTest(portalUrl, clueTeacher, reportUrl) {
  cy.login(portalUrl, clueTeacher);
  cy.launchReport(reportUrl);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  chatPanel.getChatPanelToggle().click();
  cy.wait(4000);
}

describe('Teachers can communicate back and forth in chat panel', () => {
  // TODO: Re-instate the skipped tests below once learn.staging.concord.org is fully functional again
  it('verify teacher1 can add comments in My Work tab documents', () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');

    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.verifyDocumentsListDisplays('workspaces', 'my-classes', classInfo1);
    teacherNetwork.verifyDocumentName('workspaces', 'my-classes', classInfo1, workDoc);
    teacherNetwork.verifyDocumentName('workspaces', 'my-classes', classInfo1, planningDoc);
    teacherNetwork.collapseSectionClass('workspaces', 'my-classes', classInfo1);

    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo2);
    teacherNetwork.verifyDocumentsListDisplays('workspaces', 'my-network', classInfo2);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo2, workDoc);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo2, planningDoc);
    teacherNetwork.collapseSectionClass('workspaces', 'my-network', classInfo2);

    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, workDoc);
    cy.wait(1000);
    chatPanel.addCommentAndVerify("This is a teacher1 working document comment");

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, planningDoc);
    cy.wait(1000);
    chatPanel.addCommentAndVerify("This is a teacher1 planning document comment");
  });
  it("verify teacher2 can view teacher1's comments and add more comments in My Work tab", () => {
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');

    // This line is flakey because often CLUE is not able to load in the network
    // data for this teacher fast enough. The teacher has a lot of classes. Many
    // of them have network documents.
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.verifyDocumentsListDisplays('workspaces', 'my-network', classInfo1);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo1, workDoc);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo1, planningDoc);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, workDoc);
    cy.wait(1000);
    chatPanel.verifyCommentThreadContains("This is a teacher1 working document comment");
    chatPanel.addCommentAndVerify("This is teacher2's comment on teacher1's working document");

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, planningDoc);
    cy.wait(1000);
    chatPanel.verifyCommentThreadContains("This is a teacher1 planning document comment");
    chatPanel.addCommentAndVerify("This is teacher2's comment on teacher1's planning document");
  });
  it("verify teacher1 can view teacher2's comments in My Work tab", () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');

    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, workDoc);
    chatPanel.verifyCommentThreadContains("This is teacher2's comment on teacher1's working document");

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, planningDoc);
    chatPanel.verifyCommentThreadContains("This is teacher2's comment on teacher1's planning document");
  
  //TODO: verify delete is disabled for now until work is merged to master, but keep the delete to clean up chat space
    cy.log('verify teacher1 can only delete own comments');
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").should("not.exist");
    cy.get(".user-name").contains("Clue Teacher1").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    // chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 planning document comment");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, workDoc);
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").should("not.exist");
    cy.get(".user-name").contains("Clue Teacher1").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    // chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 working document comment");
  });
  it('verify teacher2 does not see teacher1 deleted comments', () => {
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, workDoc);
    // chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 working document comment");
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    // chatPanel.getCommentFromThread().should("not.exist");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, planningDoc);
    // chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 planning document comment");
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    // chatPanel.getCommentFromThread().should("not.exist");
  });
});
