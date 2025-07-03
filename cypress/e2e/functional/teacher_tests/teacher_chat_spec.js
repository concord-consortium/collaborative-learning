import { ChatTestHelpers } from "../../../support/helpers/chat-test-helpers";

context('Chat Panel', () => {
  it('verify chat panel', () => {
    cy.log('verify chat panel is accessible if teacher is in network (via url params)');
    ChatTestHelpers.beforeTest("qaUnitTeacher6Network", "Teacher 6");

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

  it('verify chat is available in various user tabs and subtabs', () => {
    ChatTestHelpers.beforeTest("qaUnitTeacher6Network", "Teacher 6");

    ChatTestHelpers.testChatAvailabilityAcrossBasicTabs();
  });

  it('verify chat is available in various teacher user tabs and subtabs', () => {
    ChatTestHelpers.beforeTest("qaUnitTeacher6Network", "Teacher 6");

    ChatTestHelpers.testChatAvailabilityAcrossTeacherTabs();
  });

  it('verify chat is available in sort work tab', () => {
    ChatTestHelpers.beforeTest("qaConfigSubtabsUnitTeacher1", "Teacher 1");

    ChatTestHelpers.testChatAvailabilityInSortWorkTab("No Group");
  });
});

context('Commented Document List', () => {
  it('Comment all document list', () => {
    ChatTestHelpers.beforeTest("clueTestqaUnitTeacher6", "Teacher 6");

    ChatTestHelpers.testCommentedDocumentList();
  });
});
