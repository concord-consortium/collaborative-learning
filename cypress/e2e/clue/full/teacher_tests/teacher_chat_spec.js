import ChatPanel from "../../../../support/elements/clue/ChatPanel";
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
let dashboard = new TeacherDashboard();

const portalUrl = "https://learn.portal.staging.concord.org";
const offeringId1 = "221";
const offeringId2 = "226";
const reportUrl1 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId1 + "/external_report/11";
const reportUrl2 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId2 + "/external_report/11";
const clueTeacher1 = {
  username: "clueteachertest1",
  password: "password"
};
const clueTeacher2 = {
  username: "clueteachertest2",
  password: "password"
};
const teacher1DocComment = "This is a teacher1 document comment " + Math.random();
const teacher1TileComment = "This is a teacher1 tile comment " + Math.random();
const teacher2DocComment = "This is a teacher2 document comment " + Math.random();
const teacher2TileComment = "This is a teacher2 tile comment " + Math.random();

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
  it("login teacher1 and setup clue chat", () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");

    cy.log("verify teacher1 can post document and tile comments");
    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    cy.wait(1000);
    chatPanel.addCommentAndVerify(teacher1DocComment);
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.addCommentAndVerify(teacher1TileComment);
  });
  it("login teacher2 and setup clue chat", () => {
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");

    cy.log("verify teacher2 can view teacher1's comments and add more comments");
    // Teacher 2 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains(teacher1DocComment);
    chatPanel.addCommentAndVerify(teacher2DocComment);
    // Teacher 2 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains(teacher1TileComment);
    chatPanel.addCommentAndVerify(teacher2TileComment);
  });
  it("verify reopening teacher1's clue chat in the same network", () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");

    cy.log("verify teacher1 can view teacher2's comments");
    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains(teacher2DocComment);
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains(teacher2TileComment);
  });
  it('verify teacher1 can only delete own comments', () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    cy.wait(2000);
    chatPanel.getDeleteMessageButtonForUser("Clue Teacher2").should("not.exist");
    chatPanel.getDeleteMessageButton(teacher1DocComment).click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    chatPanel.getCommentFromThread().should("not.contain", teacher1DocComment);
    cy.clickProblemResourceTile('introduction');
    chatPanel.getDeleteMessageButtonForUser("Clue Teacher2").should("not.exist");
    chatPanel.getDeleteMessageButton(teacher1TileComment).click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    chatPanel.getCommentFromThread().should("not.contain", teacher1TileComment);
  });
  it('verify teacher2 does not see teacher1 deleted comments', () => {
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.getCommentFromThread().should("not.contain", teacher1DocComment);
    chatPanel.getDeleteMessageButton(teacher2DocComment).click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    cy.clickProblemResourceTile('introduction');
    chatPanel.getCommentFromThread().should("not.contain", teacher1TileComment);
    chatPanel.getDeleteMessageButton(teacher2TileComment).click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
  });
});
