import ChatPanel from "../../../support/elements/common/ChatPanel";
import { ChatTestHelpers } from "../../../support/helpers/chat-test-helpers";

const chatPanel = new ChatPanel;

context("Chat Panel", () => {
  it("should be disabled for students in curricula that don't support student comments", () => {
    ChatTestHelpers.beforeTest("qaMothPlotUnitStudent5", "Student 5");
    chatPanel.getChatPanelToggle().should('not.exist');
  });

  it("should be disabled for students on the Problems tab", () => {
    ChatTestHelpers.beforeTest("qaUnitStudent5", "Student 5");
    cy.openTopTab("problems");
    chatPanel.getChatPanelToggle().should('not.exist');
  });

  it("should be enabled for students on the My Work tab in QA config", () => {
    ChatTestHelpers.beforeTest("qaUnitStudent5", "Student 5");

    cy.openTopTab("my-work");
    cy.wait(1000);

    // click on a document
    cy.get(".scaled-list-item-container").first().click();

    ChatTestHelpers.verifyChatPanelBasics();
    // This check will fail because commenting on curriculum is not currently supported,
    // but student commenting on curriculum may be supported in the future.
    // ChatTestHelpers.verifyDocumentAndTileHighlighting();
    ChatTestHelpers.testStudentCommentCancellation();
    ChatTestHelpers.testCommentPosting();
    ChatTestHelpers.testWorkspaceTabHighlighting();
    ChatTestHelpers.testKeyboardShortcuts();
    ChatTestHelpers.testCommentDeletion();
  });


  // These checks will fail because commenting on curriculum is not currently supported,
  // but student commenting on curriculum may be supported in the future.
  // it('verify chat is available in various tabs and subtabs', () => {
  //   ChatTestHelpers.beforeTest("qaUnitStudent5", "Student 5");

  //   ChatTestHelpers.testChatAvailabilityAcrossBasicTabs();
  // });

  it('verify chat is available in sort work tab', () => {
    ChatTestHelpers.beforeTest("qaConfigSubtabsUnitStudent5", "Student 5");

    ChatTestHelpers.testChatAvailabilityInSortWorkTab("Group 5");
  });

});
