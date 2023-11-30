import ChatPanel from "../../../support/elements/common/ChatPanel";

let chatPanel = new ChatPanel;

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
const ss = [{ "section": "problems",
              "subsection": "Introduction",
              "sectionCode": "introduction" },
            { "section": "problems",
              "subsection": "Initial Challenge",
              "sectionCode": "initialChallenge" }
            ];

function beforeTest(url, clueTeacher, reportUrl) {
  cy.login(url, clueTeacher);
  cy.launchReport(reportUrl);
  cy.waitForLoad();
  chatPanel.getChatPanelToggle().click();
  chatPanel.getChatPanel().should("be.visible");
  cy.wait(10000);
}

describe('Delete Teacher Comments In chat panel', () => {
  it("Remove teacher comments in chat panel", () => {
    beforeTest(portalUrl, clueTeacher1, reportUrl1);

    ss.forEach(tab => {
      cy.openTopTab(tab.section);
      cy.openProblemSection(tab.subsection);
      cy.wait(5000);
      // Teacher 1 document comment
      chatPanel.deleteTeacherComments();
      // click first tile
      cy.clickProblemResourceTile(tab.sectionCode);
      // Teacher 1 tile comment
      chatPanel.deleteTeacherComments();
    });
    
    cy.log("login teacher2 and setup clue chat");
    cy.logout(portalUrl);
    beforeTest(portalUrl, clueTeacher2, reportUrl2);

    ss.forEach(tab => {
      cy.openTopTab(tab.section);
      cy.openProblemSection(tab.subsection);
      cy.wait(5000);
      // Teacher 2 document comment
      chatPanel.deleteTeacherComments();
      // click first tile
      cy.clickProblemResourceTile(tab.sectionCode);
      // Teacher 2 tile comment
      chatPanel.deleteTeacherComments();
    });
    
  });
});
