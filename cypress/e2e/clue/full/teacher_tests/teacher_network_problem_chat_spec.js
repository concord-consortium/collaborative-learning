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
  it("verify teacher1 can add comments in Problem tab documents and tiles", ()=> {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    // chatPanel.openTeacherChat(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    cy.wait(1000);
    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentAndVerify("This is a teacher1 problem document comment");
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    cy.wait(1000);
    chatPanel.addCommentAndVerify("This is a teacher1 problem tile comment");
  });
  it("verify teacher2 can view teacher1's comments and add more comments in Problem tab", () => {
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    cy.wait(2000);

    // Teacher 2 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher1 problem document comment");
    chatPanel.addCommentAndVerify("This is a teacher2 problem document comment");
    // Teacher 2 tile comment
    cy.clickProblemResourceTile('introduction');
    cy.wait(2000);
    chatPanel.verifyCommentThreadContains("This is a teacher1 problem tile comment");
    chatPanel.addCommentAndVerify("This is a teacher2 problem tile comment");
  });
  it("verify teacher1 can view teacher2's comments in Problem tab", () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    cy.wait(2000);

    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher2 problem document comment");
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    cy.wait(2000);
    chatPanel.verifyCommentThreadContains("This is a teacher2 problem tile comment");
  });
  //TODO: verify delete is disabled for now until work is merged to master, but keep the delete to clean up chat space
  it('verify teacher1 can only delete own comments', () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    cy.wait(2000);
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").should("not.exist");
    cy.get(".user-name").contains("Clue Teacher1").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 problem tile comment");
    cy.clickProblemResourceTile('introduction');
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").should("not.exist");
    cy.get(".user-name").contains("Clue Teacher1").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 problem document comment");
  });
  it('verify teacher2 does not see teacher1 deleted comments', () => {
    beforeTest(portalUrl, clueTeacher2, reportUrl2);
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 problem document comment");
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    chatPanel.getCommentFromThread().should("not.exist");
    // chatPanel.getCommentFromThread().should("not.contain", "This is a teacher2 problem document comment");
    cy.clickProblemResourceTile('introduction');
    chatPanel.getCommentFromThread().should("not.contain", "This is a teacher1 problem tile comment");
    cy.get(".user-name").contains("Clue Teacher2").siblings("[data-testid=delete-message-button]").click();
    cy.get(".confirm-delete-alert button").contains("Delete").click();
    chatPanel.getCommentFromThread().should("not.exist");
  });
});
