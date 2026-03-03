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

    const aiComment = "Mock reply from AI analysis";

    // Should show rating buttons on the AI comment
    chatPanel.getRatingButtonsForComment(aiComment).should('be.visible');
    chatPanel.getRatingButtonsForComment(aiComment).should('contain.text', 'Do you agree with Ada Insight?');
    chatPanel.getRatingButtonsForComment(aiComment).find('[data-testid=rating-yes-button]')
      .should('be.visible').and('contain.text', 'Yes');
    chatPanel.getRatingButtonsForComment(aiComment).find('[data-testid=rating-no-button]')
      .should('be.visible').and('contain.text', 'No');
    chatPanel.getRatingButtonsForComment(aiComment).find('[data-testid=rating-not-sure-button]')
      .should('be.visible').and('contain.text', 'Not Sure');

    // Clicking Yes should select it and show count
    chatPanel.clickRatingYes(aiComment);
    chatPanel.verifyRatingButtonSelected(aiComment, 'rating-yes-button');
    chatPanel.verifyRatingCount(aiComment, 'rating-yes-button', 1);

    // Clicking Yes again should toggle it off and remove count
    chatPanel.clickRatingYes(aiComment);
    chatPanel.verifyRatingButtonNotSelected(aiComment, 'rating-yes-button');
    chatPanel.verifyRatingCountNotVisible(aiComment, 'rating-yes-button');

    // Clicking No should select it
    chatPanel.clickRatingNo(aiComment);
    chatPanel.verifyRatingButtonSelected(aiComment, 'rating-no-button');
    chatPanel.verifyRatingCount(aiComment, 'rating-no-button', 1);

    // Switching to Yes should deselect No and select Yes
    chatPanel.clickRatingYes(aiComment);
    chatPanel.verifyRatingButtonSelected(aiComment, 'rating-yes-button');
    chatPanel.verifyRatingButtonNotSelected(aiComment, 'rating-no-button');
    chatPanel.verifyRatingCount(aiComment, 'rating-yes-button', 1);
    chatPanel.verifyRatingCountNotVisible(aiComment, 'rating-no-button');

    // Clear the rating for a clean state
    chatPanel.clickRatingYes(aiComment);
    chatPanel.verifyRatingButtonNotSelected(aiComment, 'rating-yes-button');

    // Posting a reply should not affect rating buttons on the AI comment
    cy.get("[data-testid=comment-textarea]").scrollIntoView().type('I think Ada is correct.', {force: true});
    chatPanel.getCommentPostButton().should('be.visible').click();
    chatPanel.getRatingButtonsForComment(aiComment).should('be.visible');

    // The reply comment should also have its own rating buttons
    chatPanel.getRatingButtonsForComment('I think Ada is correct.').should('be.visible');

    // Clean up: delete the reply
    chatPanel.getDeleteMessageButton('I think Ada is correct.').should('be.visible').click();
    chatPanel.getDeleteConfirmModalButton().click();

    // Rating buttons should still be on the AI comment after reply deletion
    chatPanel.getRatingButtonsForComment(aiComment).should('be.visible');

    // Should show rating buttons on a new AI analysis too
    canvas.getIdeasButton().should("be.visible").click();
    cy.get('[data-testid=comment-card-content]', { timeout: 60000 })
      .should("contain.text", "Mock reply from AI analysis");
    chatPanel.getRatingButtons().should('exist');

  });

});
