import ChatPanel from "../../../support/elements/common/ChatPanel";

let chatPanel = new ChatPanel;

const portalUrl = "https://learn.portal.staging.concord.org";
const offeringId1 = "279";
const offeringId2 = "280";
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
const teacher1SecondDocComment = "This is a teacher1 document comment " + Math.random();
const teacher1SecondTileComment = "This is a teacher1 tile comment " + Math.random();

function beforeTest(url, clueTeacher, reportUrl) {
  cy.login(url, clueTeacher);
  cy.launchReport(reportUrl);
  cy.waitForLoad();
  chatPanel.getChatPanel().should("be.visible");
  cy.openTopTab("problems");
  cy.openProblemSection("Initial Challenge");
  cy.clickProblemResource();
  cy.wait(10000);
}

describe('Teachers can communicate back and forth in chat panel', () => {
  it("teachers can communicate back and forth in chat panel", () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);

    cy.log("verify teacher1 can post document and tile comments");
    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.addDocumentCommentAndVerify(teacher1DocComment);

    chatPanel.getDeleteMessageButton(teacher1DocComment).click();
    chatPanel.getDeleteConfirmModalButton().click();
    chatPanel.getFocusedThread().should("not.contain", teacher1DocComment);
    chatPanel.addDocumentCommentAndVerify(teacher1SecondDocComment);

    // Teacher 1 tile comment
    cy.clickProblemResourceTile('initialChallenge');
    chatPanel.addTileCommentAndVerify(teacher1TileComment);

    chatPanel.getDeleteMessageButton(teacher1TileComment).click();
    chatPanel.getDeleteConfirmModalButton().click();
    chatPanel.getFocusedThread().should("not.contain", teacher1TileComment);
    chatPanel.addTileCommentAndVerify(teacher1SecondTileComment);

    cy.log("login teacher2 and setup clue chat");
    cy.logout(portalUrl);
    beforeTest(portalUrl, clueTeacher2, reportUrl2);

    cy.log("verify teacher2 can view teacher1's comments and add more comments");
    // Teacher 2 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains(teacher1SecondDocComment);
    chatPanel.addDocumentCommentAndVerify(teacher2DocComment);
    chatPanel.getDeleteMessageButtonForUser("Clue Teacher1").should("not.exist");
    chatPanel.getFocusedThread().should("not.contain", teacher1DocComment);
    chatPanel.getFocusedThread().should("contain", teacher1SecondDocComment);
    chatPanel.getDeleteMessageButton(teacher2DocComment).click();
    chatPanel.getDeleteConfirmModalButton().click();
    // Teacher 2 tile comment
    cy.clickProblemResourceTile('initialChallenge');
    chatPanel.verifyCommentThreadContains(teacher1SecondTileComment);
    chatPanel.addTileCommentAndVerify(teacher2TileComment);
    chatPanel.getDeleteMessageButtonForUser("Clue Teacher1").should("not.exist");
    chatPanel.getFocusedThread().should("not.contain", teacher1TileComment);
    chatPanel.getFocusedThread().should("contain", teacher1SecondTileComment);
    chatPanel.getDeleteMessageButton(teacher2TileComment).click();
    chatPanel.getDeleteConfirmModalButton().click();
  });
});
