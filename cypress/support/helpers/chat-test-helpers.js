import ClueCanvas from "../elements/common/cCanvas";
import ChatPanel from "../elements/common/ChatPanel";
import SortedWork from "../elements/common/SortedWork";

let sortWork = new SortedWork;

const clueCanvas = new ClueCanvas;
const chatPanel = new ChatPanel;
const selectedChatBackground = 'rgb(247, 251, 199)';
const expandedChatBackground = 'rgb(234, 242, 142)';
const basicTabs = [{ "section": "problems",
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
              "sectionCode": "nowWhatDoYouKnow" }];
const teacherTabs = [{ "section": "teacher-guide",
              "subsection": "Launch",
              "sectionCode": "launch" },
              { "section": "teacher-guide",
              "subsection": "Explore",
              "sectionCode": "explore" },
              { "section": "teacher-guide",
              "subsection": "Summarize",
              "sectionCode": "summarize" }];
const comment = [ "This is document comment for ", "This is tile comment for " ];

export class ChatTestHelpers {

  static beforeTest(configName, expectedUsername) {
    const queryParams = `${Cypress.config(configName)}`;
    cy.visit(queryParams);
    cy.waitForLoad();
    cy.openTopTab("problems");

    // Store expected username for later verification
    cy.wrap(expectedUsername).as('expectedUsername');
  }

  /**
   * Setup function for tests that need commented document list functionality
   * @param {string} queryParams - The query parameters for the test configuration
   */
  static beforeTestCommentedDocumentList(queryParams) {
    cy.visit(queryParams);
    cy.waitForLoad();
    cy.openTopTab("my-work");
    cy.wait(5000);
  }

  static verifyChatPanelBasics() {
    cy.log('verify chat panel opens and closes');
    chatPanel.getChatPanelToggle().should('exist');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanelToggle().should('not.exist');
    chatPanel.getChatPanel().should('exist').should('contain.text', 'Comments');
    chatPanel.getNotificationToggle().should('exist');
    chatPanel.getChatCloseButton().should('exist').click();
    chatPanel.getChatPanel().should('not.exist');
    chatPanel.getChatCloseButton().should('not.exist');
    chatPanel.getChatPanelToggle().should('exist');
  }

  static verifyDocumentAndTileHighlighting() {
    cy.log('verify new comment card exists, card icon exists and Post button is disabled');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getCommentCard().should('exist');

    cy.log('verify the comment card and the document are highlighted');
    chatPanel.verifyProblemCommentClass();
    chatPanel.getProblemDocumentContent().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
    chatPanel.getSelectedCommentThreadHeader().should('have.css', 'background-color').and('eq', expandedChatBackground);

    cy.log('verify the comment card and tile are highlighted and have tile icon');
    cy.clickProblemResourceTile('introduction');
    chatPanel.getSelectedCommentThreadHeader().should('exist').should('have.css', 'background-color').and('eq', expandedChatBackground);
    chatPanel.getCommentTileTypeIcon().should('exist');
    chatPanel.getToolTile().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
  }

  static testCommentCancellationCommon() {
    cy.log('verify user can cancel a comment');
    const documentComment = "This comment is for the document.";
    chatPanel.typeInCommentArea(documentComment);
    chatPanel.getCommentCancelButton().scrollIntoView();
    chatPanel.verifyCommentAreaContains(documentComment);
    chatPanel.getCommentCancelButton().scrollIntoView().click();
    chatPanel.verifyCommentAreaDoesNotContain(documentComment);
  }

  static testStudentCommentCancellation() {
    chatPanel.getChatPanelToggle().click();
    cy.wait(2000);
    this.testCommentCancellationCommon();
  }

  static testCommentCancellation() {
    cy.openProblemSection("Introduction");
    cy.wait(2000);
    this.testCommentCancellationCommon();
  }

  static testCommentPosting() {
    cy.log('verify user can post a comment');
    const documentComment1 = "An alert should show this document comment.";
    chatPanel.addDocumentCommentAndVerify(documentComment1);

    cy.log('verify user name and initial appear on comment correctly');
    cy.get('@expectedUsername').then(expectedUsername => {
      chatPanel.getUsernameFromCommentHeader().should('contain', expectedUsername);
    });
    chatPanel.getDeleteMessageButton(documentComment1).click();
    chatPanel.getDeleteConfirmModalButton().click();
  }

  static testWorkspaceTabHighlighting() {
    cy.log('verify workspace tab document is highlighted');
    clueCanvas.getInvestigationCanvasTitle().text().then((title) => {
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'workspaces');
      cy.openDocumentThumbnail('my-work', 'workspaces', title);
      chatPanel.verifyDocumentCommentClass();
    });
  }

  static testKeyboardShortcuts() {
    cy.log("verify escape key empties textarea");
    chatPanel.typeInCommentArea("this should be erased. {esc}");
    chatPanel.verifyCommentAreaContains("");

    cy.log('verify user can use shift+enter to go to the next line and not post');
    chatPanel.typeInCommentArea("this is the first line. {shift}{enter}");
    chatPanel.verifyCommentAreaContains("");
    chatPanel.typeInCommentArea("this is the second line.");
    chatPanel.clickPostCommentButton();
    chatPanel.verifyCommentThreadLength(1);
    chatPanel.verifyCommentThreadContains("this is the first line.\nthis is the second line.");

    cy.log('verify user can use enter to send post');
    chatPanel.typeInCommentArea("Send this comment after enter.");
    chatPanel.useEnterToPostComment();
    chatPanel.verifyCommentThreadLength(1);
    chatPanel.verifyCommentThreadContains("Send this comment after enter.");
  }

  static testCommentDeletion() {
    cy.log('verify user can delete a comment');
    const msgToDelete = "Send this comment after enter.";
    chatPanel.getDeleteMessageButton(msgToDelete).click({ force: true });
    chatPanel.getDeleteConfirmModalButton().click();
    cy.wait(2000);
    chatPanel.verifyCommentThreadLength(1);
    chatPanel.verifyCommentThreadDoesNotContain(msgToDelete);
  }

  static testDocumentVsTileCommenting() {
    cy.log("verify commenting on document only shows document comment");
    cy.openTopTab("problems");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addDocumentCommentAndVerify("This is a document comment");
    cy.clickProblemResourceTile('introduction');
    chatPanel.addTileCommentAndVerify("This is a tile comment for the first tile");
    cy.clickProblemResourceTile('introduction', 2);
    chatPanel.addTileCommentAndVerify("This is the 3rd tile comment.");

    cy.log("verify commenting on tile only shows tile comment");
    chatPanel.showAndVerifyTileCommentClass(2);
    chatPanel.verifyCommentThreadDoesNotContain("This is a document comment");
    chatPanel.verifyCommentThreadDoesNotContain("This is a tile comment for the first tile");
    chatPanel.verifyCommentThreadContains("This is the 3rd tile comment.");
    chatPanel.getDeleteMessageButton("This is the 3rd tile comment.").click();
    chatPanel.getDeleteConfirmModalButton().click();
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass();
    chatPanel.verifyCommentThreadDoesNotContain("This is a document comment");
    chatPanel.verifyCommentThreadContains("This is a tile comment for the first tile");
    chatPanel.verifyCommentThreadDoesNotContain("This is the 3rd tile comment.");
    chatPanel.getDeleteMessageButton("This is a tile comment for the first tile").click();
    chatPanel.getDeleteConfirmModalButton().click();

    cy.log("verify clicking problem section tab shows document comment");
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyTileCommentDoesNotHaveClass();
    chatPanel.verifyCommentThreadContains("This is a document comment");
    chatPanel.getDeleteMessageButton("This is a document comment").click();
    chatPanel.getDeleteConfirmModalButton().click();
  }

  static testDocumentSelectionOnTabSwitch() {
    cy.log("verify document is selected when switching between tabs");
    cy.openTopTab("problems");
    // Open Introduction tab and show tile comment
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass();
    // Open Initial Challenge tab and show tile comment
    cy.openProblemSection("Initial Challenge");
    chatPanel.verifyProblemCommentClass();
    cy.clickProblemResourceTile('initialChallenge');
    chatPanel.showAndVerifyTileCommentClass();
    // Return to Introduction tab and make sure document comment and not tile comment is shown
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyTileCommentDoesNotHaveClass();
  }

  static testChatAvailabilityAcrossTabs(tabSet) {
    chatPanel.getChatPanelToggle().should('exist');
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanel().should('exist');

    tabSet.forEach(tab => {
      let message = `${tab.section} section - ${tab.subsection} tab`;
      cy.log(`verify chat is available on ${message}`);
      cy.openTopTab(tab.section);
      cy.openProblemSection(tab.subsection);
      cy.wait(2000);
      // document comment
      chatPanel.addDocumentCommentAndVerify(comment[0]+message);
      chatPanel.getDeleteMessageButton(comment[0]+message).click({ force: true });
      chatPanel.getDeleteConfirmModalButton().click();
      // click first tile
      cy.clickProblemResourceTile(tab.sectionCode);
      // tile comment
      chatPanel.addTileCommentAndVerify(comment[1]+message);
      chatPanel.getDeleteMessageButton(comment[1]+message).click({ force: true });
      chatPanel.getDeleteConfirmModalButton().click();
    });
  }

  static testChatAvailabilityAcrossBasicTabs() {
    ChatTestHelpers.testChatAvailabilityAcrossTabs(basicTabs);
  }

  static testChatAvailabilityAcrossTeacherTabs() {
    ChatTestHelpers.testChatAvailabilityAcrossTabs(teacherTabs);
  }

  static testChatAvailabilityInSortWorkTab(groupName) {
    cy.log("verify chat is available on Sort Work tab");
    cy.openTopTab("sort-work");
    cy.wait(2000);
    chatPanel.getChatPanelToggle().should("exist");
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanel().should("exist");
    sortWork.openSortWorkSection(groupName);
    // Click on the first document in the documents list.
    sortWork.getSortWorkItem().first().click();
    chatPanel.addDocumentCommentAndVerify("This is a document comment");
  }

  static testCommentedDocumentList() {
    chatPanel.openChatPanel();
    cy.wait(2000);
    chatPanel.documentCommentList();
  }
}
