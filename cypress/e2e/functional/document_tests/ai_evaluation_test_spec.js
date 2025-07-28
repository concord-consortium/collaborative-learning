import Canvas from '../../../support/elements/common/Canvas';
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import ChatPanel from "../../../support/elements/common/ChatPanel";

let canvas = new Canvas,
  resourcesPanel = new ResourcesPanel,
  chatPanel = new ChatPanel;

// qa unit has mock AI analysis
/// TODO: remove firebaseEnv=staging once we have the rules deployed to production
const queryParams = `${Cypress.config("qaUnitStudent5")}&firebaseEnv=staging`;

const studentDocumentName = "QA 1.1 Solving a Mystery with Proportional Reasoning";
const aiEvaluationPendingMessage = "Ada is thinking about it...";

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('AI Evaluation', function () {
  it('Clicking Ideas button triggers AI analysis', function () {
    beforeTest(queryParams);

    canvas.getIdeasButton().should("be.visible").click();

    // The left side should be changed to show the user's document and the comments pane
    resourcesPanel.getPrimaryWorkspaceTab("my-work").should("have.class", "selected");
    resourcesPanel.getFocusDocument().should("be.visible");
    resourcesPanel.getFocusDocumentTitle().should("contain.text", studentDocumentName);

    // Should open the chat and select the whole document comments section
    chatPanel.getChatPanel().should('be.visible').should('contain.text', 'Comments');
    chatPanel.getChatThread().eq(0).should("have.class", "chat-thread-focused");
    chatPanel.getUsernameFromCommentHeader().should("be.visible").and("contain.text", "Ada Insight");

    // Should show the pending message
    chatPanel.getCommentCardContent().should("be.visible")
      .and("contain.text", aiEvaluationPendingMessage);

    // And eventually should show the AI analysis result
    cy.get('[data-testid=comment-card-content]', { timeout: 60000 })
      .should("contain.text", "Mock reply from AI analysis");

    // Should show the AI agree buttons once the AI analysis is complete
    chatPanel.getCommentCard().find('[data-testid=comment-agree]').should('be.visible');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-header]').should('be.visible')
      .and('contain.text', 'Do you agree with Ada?');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-buttons]').should('be.visible');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-yes-button]').should('be.visible')
      .and('contain.text', 'Yes');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-no-button]').should('be.visible')
      .and('contain.text', 'No');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-not-sure-button]').should('be.visible')
      .and('contain.text', '…?');

    // should allow posting a comment and selecting agree/disagree/not sure
    cy.get("[data-testid=comment-textarea]").scrollIntoView().type('I think Ada is correct.', {force: true});
    chatPanel.getCommentCard().find('[data-testid=comment-agree-yes-button]').should('be.visible').click();
    chatPanel.getCommentPostButton().should('be.visible').click();

    // once posted, the comment should show the agree message
    chatPanel.getCommentCard().find('[data-testid=comment-agree-message-yes]').should('be.visible')
      .and('contain.text', 'Yes');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-icon]').should('be.visible');

    // the AI agree buttons should not be visible after posting
    chatPanel.getCommentCard().find('[data-testid=comment-agree]').should('not.exist');

    // should allow deleting the comment
    chatPanel.getDeleteMessageButton('I think Ada is correct.').should('be.visible').click();
    chatPanel.getDeleteConfirmModalButton().click();

    // after deletion, the AI agree buttons should be visible again
    chatPanel.getCommentCard().find('[data-testid=comment-agree]').should('be.visible');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-header]').should('be.visible')
      .and('contain.text', 'Do you agree with Ada?');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-buttons]').should('be.visible');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-yes-button]').should('be.visible')
      .and('contain.text', 'Yes');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-no-button]').should('be.visible')
      .and('contain.text', 'No');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-not-sure-button]').should('be.visible')
      .and('contain.text', '…?');

    // should allow posting a comment without selecting agree/disagree/not sure
    cy.get("[data-testid=comment-textarea]").scrollIntoView().type('I like eggs.', {force: true});
    chatPanel.getCommentPostButton().should('be.visible').click();

    // the comment should not show any agree message
    chatPanel.getCommentCard().find('[data-testid=comment-agree-message]').should('not.exist');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-icon]').should('not.exist');

    // test not agree with AI message
    chatPanel.getCommentCard().find('[data-testid=comment-agree-no-button]').should('be.visible').click();
    cy.get("[data-testid=comment-textarea]").scrollIntoView().type('Nope, WRONG!', {force: true});
    chatPanel.getCommentPostButton().should('be.visible').click();
    chatPanel.getCommentCard().find('[data-testid=comment-agree-message-no]').should('be.visible')
      .and('contain.text', 'No, I disagree with Ada.');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-icon]').should('be.visible');
    chatPanel.getCommentCard().find('[data-testid=comment-agree]').should('not.exist');

    // should allow deleting the comment
    chatPanel.getDeleteMessageButton('Nope, WRONG!').should('be.visible').click();
    chatPanel.getDeleteConfirmModalButton().click();

    // test not sure about AI message
    chatPanel.getCommentCard().find('[data-testid=comment-agree-not-sure-button]').should('be.visible').click();
    cy.get("[data-testid=comment-textarea]").scrollIntoView().type('I am not sure about this.', {force: true});
    chatPanel.getCommentPostButton().should('be.visible').click();
    chatPanel.getCommentCard().find('[data-testid=comment-agree-message-not-sure]').should('be.visible')
      .and('contain.text', 'Not sure I agree with Ada.');
    chatPanel.getCommentCard().find('[data-testid=comment-agree-icon]').should('be.visible');
    chatPanel.getCommentCard().find('[data-testid=comment-agree]').should('not.exist');

    // should show the AI agree buttons again after another AI analysis
    canvas.getIdeasButton().should("be.visible").click();
    cy.get('[data-testid=comment-card-content]', { timeout: 60000 })
      .should("contain.text", "Mock reply from AI analysis");
    chatPanel.getCommentCard().find('[data-testid=comment-agree]').should('exist');

  });

});
