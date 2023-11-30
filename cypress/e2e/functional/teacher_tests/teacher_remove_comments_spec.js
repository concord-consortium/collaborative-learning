import ChatPanel from "../../../support/elements/common/ChatPanel";

let chatPanel = new ChatPanel;

const queryParams = {
  teacher7QaNetworkQueryParams: "/?unit=https://models-resources.concord.org/clue-curriculum/branch/add-test-unit-qa/qa/content.json&problem=0.1&appMode=qa&demoName=add-test-unit-qa&fakeClass=5&fakeUser=teacher:7&network=foo",
  teacher7MsaNetworkQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo"
};

const ss = [{ "section": "problems",
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
              "sectionCode": "summarize" }];

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.openTopTab("problems");
  chatPanel.getChatPanelToggle().should('exist');
  chatPanel.getChatPanelToggle().click();
  cy.wait(10000);
}

context('Delete Comments', () => {
  it('Delete chat panel comment tags', () => {
    beforeTest(queryParams.teacher7QaNetworkQueryParams);

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
    beforeTest(queryParams.teacher7MsaNetworkQueryParams);

    ss.forEach(tab => {
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
