import ChatPanel from "../../../../support/elements/clue/ChatPanel";
import TeacherNetwork from "../../../../support/elements/clue/TeacherNetwork";
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

const portalUrl = "https://learn.staging.concord.org";
const offeringId1 = "2000";
const offeringId2 = "2004";
const reportUrl1 = "https://learn.staging.concord.org/portal/offerings/" + offeringId1 + "/external_report/49";
const reportUrl2 = "https://learn.staging.concord.org/portal/offerings/" + offeringId2 + "/external_report/49";
const clueTeacher1 = {
  username: "TejalTeacher1",
  password: "ccpassword",
  firstname: "Tejal",
  lastname: "Teacher1"
};
const clueTeacher2 = {
  username: "TejalTeacher2",
  password: "ccpassword",
  firstname: "Tejal",
  lastname: "Teacher2"
};
const classInfo1 = clueTeacher1.firstname + ' ' + clueTeacher1.lastname + ' / CLUE Testing3';
const workDoc = 'MSA 1.4 Walkathon Money';
const classInfo2 = clueTeacher2.firstname + ' ' + clueTeacher2.lastname + ' / CLUE Testing Class 2';
const planningDoc = 'MSA 1.4 Walkathon Money: Planning';

describe('Teachers can communicate back and forth in chat panel', () => {
  it("verify teacher1 can add comments in Problem tab documents and tiles", ()=> {
    chatPanel.openTeacherChat(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");

    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentAndVerify("This is a teacher1 document comment");
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.addCommentAndVerify("This is a teacher1 tile comment");
  });
  it("verify teacher2 can view teacher1's comments and add more comments in Problem tab", () => {
    chatPanel.openTeacherChat(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");

    // Teacher 2 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher1 document comment");
    chatPanel.addCommentAndVerify("This is a teacher2 document comment");
    // Teacher 2 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains("This is a teacher1 tile comment");
    chatPanel.addCommentAndVerify("This is a teacher2 tile comment");
  });
  it("verify teacher1 can view teacher2's comments in Problem tab", () => {
    chatPanel.openTeacherChat(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");

    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher2 document comment");
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains("This is a teacher2 tile comment");
  });
  it('verify teacher1 can add comments in My Work tab documents', () => {
    chatPanel.openTeacherChat(portalUrl, clueTeacher1, reportUrl1);
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
    chatPanel.addCommentAndVerify("This is a teacher1 working document comment");

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, planningDoc);
    chatPanel.addCommentAndVerify("This is a teacher1 planning document comment");
  });
  it("verify teacher2 can view teacher1's comments and add more comments in My Work tab", () => {
    chatPanel.openTeacherChat(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');

    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.verifyDocumentsListDisplays('workspaces', 'my-network', classInfo1);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo1, workDoc);
    teacherNetwork.verifyDocumentName('workspaces', 'my-network', classInfo1, planningDoc);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, workDoc);
    chatPanel.verifyCommentThreadContains("This is a teacher1 working document comment");
    chatPanel.addCommentAndVerify("This is teacher2's comment on teacher1's working document");

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-network', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-network', classInfo1, planningDoc);
    chatPanel.verifyCommentThreadContains("This is a teacher1 planning document comment");
    chatPanel.addCommentAndVerify("This is teacher2's comment on teacher1's planning document");
  });
  it("verify teacher1 can view teacher2's comments in My Work tab", () => {
    chatPanel.openTeacherChat(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');

    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, workDoc);
    chatPanel.verifyCommentThreadContains("This is teacher2's comment on teacher1's working document");

    cy.openSection('my-work', 'workspaces');
    teacherNetwork.expandSectionClass('workspaces', 'my-classes', classInfo1);
    teacherNetwork.selectDocument('workspaces', 'my-classes', classInfo1, planningDoc);
    chatPanel.verifyCommentThreadContains("This is teacher2's comment on teacher1's planning document");
  });

  it('verify network dividers in My Work tab for teacher in network', () => {
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    cy.openSection('my-work', 'starred');
    teacherNetwork.verifyDividerLabel('starred', 'my-classes');
    teacherNetwork.verifyDividerLabel('starred', 'my-network');

    cy.openSection('my-work', 'learning-log');
    teacherNetwork.verifyDividerLabel('learning-log', 'my-classes');
    teacherNetwork.verifyDividerLabel('learning-log', 'my-network');
  });

  it('verify network dividers in Class Work tab for teacher in network', () => {
    cy.openTopTab("class-work");
    cy.openSection('class-work', 'problem-workspaces');
    teacherNetwork.verifyDividerLabel('problem-workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('problem-workspaces', 'my-network');

    cy.openSection('class-work', 'extra-workspaces');
    teacherNetwork.verifyDividerLabel('extra-workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('extra-workspaces', 'my-network');

    cy.openSection('class-work', 'learning-logs');
    teacherNetwork.verifyDividerLabel('learning-logs', 'my-classes');
    teacherNetwork.verifyDividerLabel('learning-logs', 'my-network');

    cy.openSection('class-work', 'starred');
    teacherNetwork.verifyDividerLabel('starred', 'my-classes');
    teacherNetwork.verifyDividerLabel('starred', 'my-network');
  });
  it('verify network dividers in Supports tab for teacher in network', () => {
    cy.openTopTab("supports");
    cy.openSection('supports', 'problem-supports');
    teacherNetwork.verifyDividerLabel('problem-supports', 'my-classes');
    teacherNetwork.verifyDividerLabel('problem-supports', 'my-network');

    cy.openSection('supports', 'teacher-supports');
    teacherNetwork.verifyDividerLabel('teacher-supports', 'my-classes');
    teacherNetwork.verifyDividerLabel('teacher-supports', 'my-network');
  });
});
