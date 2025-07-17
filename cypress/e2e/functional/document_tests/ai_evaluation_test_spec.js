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
const aiEvaluationPendingMessage = "Ada is evaluating...";

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
  });

});
