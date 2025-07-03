import ChatPanel from "../../../support/elements/common/ChatPanel";
import { ChatTestHelpers } from "../../../support/helpers/chat-test-helpers";

const chatPanel = new ChatPanel;

context("Chat Panel", () => {
  it("should be disabled for students in default config", () => {
    ChatTestHelpers.beforeTest("qaMothPlotUnitStudent5", "Student 5");
    chatPanel.getChatPanelToggle().should('not.exist');
  });

  it("should be enabled for students in QA config", () => {
    ChatTestHelpers.beforeTest("qaUnitStudent5", "Student 5");

    ChatTestHelpers.verifyChatPanelBasics();
    ChatTestHelpers.verifyDocumentAndTileHighlighting();
    ChatTestHelpers.testCommentCancellation();
    ChatTestHelpers.testCommentPosting();
    ChatTestHelpers.testWorkspaceTabHighlighting();
    ChatTestHelpers.testKeyboardShortcuts();
    // ChatTestHelpers.testCommentDeletion();
    ChatTestHelpers.testDocumentVsTileCommenting();
    ChatTestHelpers.testDocumentSelectionOnTabSwitch();
  });

  it('verify chat is available in various tabs and subtabs', () => {
    ChatTestHelpers.beforeTest("qaUnitStudent5", "Student 5");

    ChatTestHelpers.testChatAvailabilityAcrossBasicTabs();
  });

  it.skip('verify chat is available in sort work tab', () => {
    ChatTestHelpers.beforeTest("qaConfigSubtabsUnitStudent5", "Student 5");

    ChatTestHelpers.testChatAvailabilityInSortWorkTab("Group 5");
  });

});
