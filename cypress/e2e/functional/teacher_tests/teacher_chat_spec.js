import ClueCanvas from "../../../support/elements/common/cCanvas";
import ChatPanel from "../../../support/elements/common/ChatPanel";

let clueCanvas = new ClueCanvas;
let chatPanel = new ChatPanel;

let selectedChatBackground = 'rgb(247, 251, 199)';
let expandedChatBackground = 'rgb(234, 242, 142)';

const teacher7NetworkQueryParams = `${Cypress.config("qaUnitTeacher6Network")}`;
const teacherQueryParams = `${Cypress.config("clueTestqaUnitTeacher6")}`;

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
const comment = [ "This is document comment for ", "This is tile comment for " ];

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.openTopTab("problems");
  chatPanel.getChatPanelToggle().should('exist');
  chatPanel.getChatPanelToggle().click();
  chatPanel.getChatPanel().should('exist');
}

function beforeTestCommentedDocumentList(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.openTopTab("my-work");
  cy.wait(5000);
}

context('Chat Panel', () => {
  it('verify chat panel', () => {
    cy.log('verify chat panel is accessible if teacher is in network (via url params)');
    beforeTest(teacher7NetworkQueryParams);

    cy.log('verify chat panel opens');
    chatPanel.getNotificationToggle().should('exist');
    chatPanel.getChatCloseButton().should('exist').click();
    chatPanel.getChatPanelToggle().should('exist');
    chatPanel.getChatPanel().should('not.exist');

    cy.log('verify new comment card exits, card icon exists and Post button is disabled');
    chatPanel.getChatPanelToggle().click();
    cy.wait(2000);
    chatPanel.getCommentCard().should('exist');

    cy.log('verify the comment card and the document are highlighted');
    chatPanel.verifyProblemCommentClass();
    chatPanel.getProblemDocumentContent().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
    chatPanel.getSelectedCommentThreadHeader().should('have.css', 'background-color').and('eq', expandedChatBackground);

    cy.log('verify the comment card and tile are highlighted and have tile icon');
    cy.clickProblemResourceTile('introduction');
    cy.wait(2000);
    chatPanel.getSelectedCommentThreadHeader().should('exist').should('have.css', 'background-color').and('eq', expandedChatBackground);
    chatPanel.getCommentTileTypeIcon().should('exist');
    chatPanel.getToolTile().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);

    cy.log('verify user can cancel a comment');
    cy.openProblemSection("Introduction");
    const documentComment = "This comment is for the document.";
    cy.wait(2000);
    chatPanel.typeInCommentArea(documentComment);
    chatPanel.getCommentCancelButton().scrollIntoView();
    chatPanel.verifyCommentAreaContains(documentComment);
    chatPanel.getCommentCancelButton().scrollIntoView().click();
    chatPanel.verifyCommentAreaDoesNotContain(documentComment);

    cy.log('verify user can post a comment');
    const documentComment1 = "An alert should show this document comment.";
    chatPanel.addDocumentCommentAndVerify(documentComment1);

    cy.log('verify teacher name and initial appear on comment correctly');
    chatPanel.getUsernameFromCommentHeader().should('contain', "Teacher 6");
    chatPanel.getDeleteMessageButton(documentComment1).click();
    chatPanel.getDeleteConfirmModalButton().click();

    cy.log('verify workspace tab document is highlighted');
    clueCanvas.getInvestigationCanvasTitle().text().then((title) => {
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'workspaces');
      cy.openDocumentThumbnail('my-work', 'workspaces', title);
      chatPanel.verifyDocumentCommentClass();
    });

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

    cy.log('verify user can delete a post');
    const msgToDelete = "Send this comment after enter.";
    chatPanel.getDeleteMessageButton(msgToDelete).click({ force: true });
    chatPanel.getDeleteConfirmModalButton().click();
    cy.wait(2000);
    chatPanel.verifyCommentThreadLength(1);
    chatPanel.verifyCommentThreadDoesNotContain(msgToDelete);

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
  });

  it('verify chat is available in various tabs and subtabs', () => {
    beforeTest(teacher7NetworkQueryParams);

    ss.forEach(tab => {
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
  });
});

context('Commented Document List', () => {
  it('Comment all document list', () => {
    beforeTestCommentedDocumentList(teacherQueryParams);
    chatPanel.openChatPanel();
    cy.wait(2000);
    chatPanel.documentCommentList();
  });
});
