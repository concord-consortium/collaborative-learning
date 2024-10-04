import ChatPanel from "../../../support/elements/common/ChatPanel";

let chatPanel = new ChatPanel;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitTeacher6Network")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.openTopTab("problems");
  chatPanel.getChatPanelToggle().should('exist');
}

context('Chat Panel Comment Tags', () => {
  it('verify chat panel comment tags', () => {
    const tags = [
      "Diverging Designs",
      "Who's it for?",
      "Where's it used?",
      "Converging Designs",
      "What's it look like?",
      "What's it do?"
    ];
    const tagComment = [
      "This is one tag comment" + Math.random(),
      "This is another tag comment" + Math.random(),
      "This is a different tag comment" + Math.random(),
      "This is the last tag comment" + Math.random()
    ];
    cy.log('verify chat panel comment tags are accessible if teacher is in network (via url params)');
    beforeTest();

    cy.log('verify comment tag dropdown');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanel().should('exist');
    chatPanel.getCommentTextDropDown().should('exist');

    cy.log('verify comment tag dropdown options');
    chatPanel.getCommentTextDropDown()
      .should("contain", tags[0])
      .should("contain", tags[1])
      .should("contain", tags[2])
      .should("contain", tags[3])
      .should("contain", tags[4])
      .should("contain", tags[5]);

    cy.log('verify user post only comment tags on document comment');
    cy.openTopTab("problems");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentTagAndVerify(tags[1]);
    chatPanel.deleteCommentTagThread(tags[1]);

    cy.log('verify user post only comment tags on tile comment');
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass(0);
    chatPanel.addCommentTagAndVerify(tags[2]);
    chatPanel.deleteCommentTagThread(tags[2]);

    cy.log('verify user post both comment tags and plain text on document comment');
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentTagTextAndVerify(tags[3], tagComment[2]);
    chatPanel.deleteCommentTagThread(tags[3]);

    cy.log('verify user post both comment tags and plain text on tile comment');
    cy.openTopTab("problems");
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass(0);
    chatPanel.addCommentTagTextAndVerify(tags[4], tagComment[3]);
    chatPanel.deleteCommentTagThread(tags[4]);

    cy.log('verify user post only plain text and comment tag not displayed on document comment');
    const docComment = "Only plain text and no comment tag document comment";
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addDocumentCommentAndVerify(docComment);
    chatPanel.verifyCommentTagNotDisplayed(docComment);
    chatPanel.getDeleteMessageButton(docComment).click({ force: true });
    chatPanel.getDeleteConfirmModalButton().click();
    cy.wait(2000);
    chatPanel.verifyCommentThreadDoesNotContain(docComment);

    cy.log('verify user post only plain text and comment tag not displayed on tile comment');
    const tileComment = "Only plain text and no comment tag tile comment";
    cy.openTopTab("problems");
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass(0);
    chatPanel.addTileCommentAndVerify(tileComment);
    chatPanel.verifyCommentTagNotDisplayed(tileComment);
    chatPanel.getDeleteMessageButton(tileComment).click({ force: true });
    chatPanel.getDeleteConfirmModalButton().click();
    cy.wait(2000);
    chatPanel.verifyCommentThreadDoesNotContain(tileComment);
  });
});
