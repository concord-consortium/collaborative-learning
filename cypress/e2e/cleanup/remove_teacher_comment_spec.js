import ChatPanel from "../../support/elements/common/ChatPanel";

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

const ss = [{ "section": "problems",
              "subsection": "Introduction",
              "sectionCode": "introduction" },
            { "section": "problems",
              "subsection": "Initial Challenge",
              "sectionCode": "initialChallenge" }
            ];

const ss1 = [{"section": "problems",
              "subsection": "Introduction",
              "sectionCode": "introduction" },
              { "section": "problems",
              "subsection": "Initial Challenge",
              "sectionCode": "initialChallenge" },
              { "section": "problems",
              "subsection": "What If...?",
              "sectionCode": "whatIf" },
              { "section": "problems",
              "subsection": "Now What Do You Know?",
              "sectionCode": "nowWhatDoYouKnow" },
              { "section": "teacher-guide",
              "subsection": "Launch",
              "sectionCode": "launch" },
              { "section": "teacher-guide",
              "subsection": "Explore",
              "sectionCode": "explore" },
              { "section": "teacher-guide",
              "subsection": "Summarize",
              "sectionCode": "summarize" }
            ];
function beforePortalTest(url, clueTeacher, reportUrl) {
  cy.login(url, clueTeacher);
  cy.launchReport(reportUrl);
  cy.waitForLoad();
  cy.wait(10000);
  chatPanel.openChatPanel();
}

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitTeacher6Network")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.openTopTab("problems");
  chatPanel.openChatPanel();
}

describe('Delete Teacher Comments In chat panel', () => {
  it("Delete teacher comments in the chat panel on the Learn portal", () => {
    beforePortalTest(portalUrl, clueTeacher1, reportUrl1);

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
    beforePortalTest(portalUrl, clueTeacher2, reportUrl2);

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
  it('Delete chat panel comment tags', () => {
    beforeTest();

    cy.log('Delete comment tags on document comment');
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.deleteTeacherComments();

    cy.log('Delete comment tags on tile comment');
    cy.openTopTab("problems");
    cy.clickProblemResourceTile('introduction');
    chatPanel.deleteTeacherComments();
  });
  it('Delete chat panel comments in subtabs', () => {
    beforeTest();

    ss1.forEach(tab => {
      cy.openTopTab(tab.section);
      cy.openProblemSection(tab.subsection);
      cy.wait(2000);
      // document comment
      cy.log('Delete comments on document comment');
      chatPanel.deleteTeacherComments();
      // click first tile
      cy.log('Delete comments on tile comment');
      cy.clickProblemResourceTile(tab.sectionCode);
      // tile comment
      chatPanel.deleteTeacherComments();
    });
  });
});
