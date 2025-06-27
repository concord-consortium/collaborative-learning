import ChatPanel from "../../../support/elements/common/ChatPanel";

let chatPanel = new ChatPanel;

function beforeTest(configName) {
  const queryParams = `${Cypress.config(configName)}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.openTopTab("problems");
}

context("Chat Panel", () => {
  it("should be disabled for students in default config", () => {
    beforeTest("qaConfigSubtabsUnitStudent5");
    chatPanel.getChatPanelToggle().should('not.exist');
  });

  it("should be enabled for students in QA config", () => {
    beforeTest("qaUnitStudent5");

    cy.log('verify chat panel opens and closes');
    chatPanel.getChatPanelToggle().should('exist');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanelToggle().should('not.exist');
    chatPanel.getChatPanel().should('exist').should('contain.text', 'Comments');
    chatPanel.getChatCloseButton().should('exist').click();
    chatPanel.getChatPanel().should('not.exist');
    chatPanel.getChatCloseButton().should('not.exist');
    chatPanel.getChatPanelToggle().should('exist');

    cy.log('verify new comment card exits, card icon exists and Post button is disabled');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getCommentCard().should('exist');

    cy.log('verify the comment card and the document are highlighted');
    chatPanel.verifyProblemCommentClass();
    chatPanel.getProblemDocumentContent().should('be.visible');

    cy.log('verify the comment card and tile are highlighted and have tile icon');
    cy.clickProblemResourceTile('introduction');
    chatPanel.getSelectedCommentThreadHeader().should('exist');
    chatPanel.getCommentTileTypeIcon().should('exist');

  });


});
