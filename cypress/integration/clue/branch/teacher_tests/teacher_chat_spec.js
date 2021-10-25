import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import ChatPanel from "../../../../support/elements/clue/ChatPanel";
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;
let chatPanel = new ChatPanel;
let resourcesPanel = new ResourcesPanel;

let selectedChatBackground = 'rgb(215, 255, 204)';

const queryParams = "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa";

before(() => {
  cy.clearQAData('all');

  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
});
beforeEach(() => {
  cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
});

describe('Chat panel for networked teacher', () => {
  it('verify chat panel is accessible if teacher is in network (via url params)', () => {
    cy.visit("/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo");
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
    resourcesPanel.getCollapsedResourcesTab().click();
    cy.openTopTab("problems");
    chatPanel.getChatPanelToggle().should('exist');
  });
  it('verify chat panel opens', () => {
    chatPanel.getChatPanelToggle().click();
    chatPanel.getChatPanel().should('exist');
    chatPanel.getNotificationToggle().should('exist');
    chatPanel.getChatCloseButton().should('exist').click();
    chatPanel.getChatPanelToggle().should('exist');
    chatPanel.getChatPanel().should('not.exist');
  });
  it('verify new comment card is visible, card icon is visible and Post button is disabled', () => {
    chatPanel.getChatPanelToggle().click();
    chatPanel.getCommentCard().should('be.visible');
    chatPanel.getCommentPostButton().should('have.class', 'disabled');
    chatPanel.getCommentCardHeaderIcon().should('be.visible');
  });
  it('verify the comment card and the document are highlighted', () => {
    chatPanel.verifyProblemCommentClass();
    chatPanel.getProblemDocumentContent().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
    chatPanel.getCommentCardContent().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
  });
  it('verify the comment card and tile are highlighted', () => {
    cy.clickProblemResourceTile('introduction');
    chatPanel.getCommentCardContent().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
    chatPanel.getToolTile().should('be.visible').should('have.css', 'background-color').and('eq', selectedChatBackground);
  });
  it('verify user can cancel a comment', () => {
    cy.openProblemSection("Introduction");
    const documentComment = "This comment is for the document.";
    chatPanel.typeInCommentArea(documentComment);
    chatPanel.verifyCommentAreaContains(documentComment);
    chatPanel.getCommentCancelButton().scrollIntoView().click();
    chatPanel.verifyCommentAreaDoesNotContain(documentComment);
  });
  it('verify user can post a comment', () => {
    const documentComment = "An alert should show this document comment.";
    chatPanel.addCommentAndVerify(documentComment);
  });
  it('verify teacher name and initial appear on comment correctly', () => {
    chatPanel.getUsernameFromCommentHeader().should('contain', "Teacher 7");
  });
  it('verify workspace tab document is highlighted', () => {
    clueCanvas.getInvestigationCanvasTitle().text().then((title)=>{
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'workspaces');
      cy.openDocumentThumbnail('workspaces', title);
      chatPanel.verifyDocumentCommentClass();
    });
  });
  it("verify escape key empties textarea", () => {
    chatPanel.typeInCommentArea("this should be erased. {esc}");
    chatPanel.verifyCommentAreaContains("");
    chatPanel.verifyCommentThreadDoesNotExist();
  });
  it('verify user can use shift+enter to go to the next line and not post', () => {
    chatPanel.typeInCommentArea("this is the first line. {shift}{enter}");
    chatPanel.verifyCommentThreadDoesNotExist();
    chatPanel.typeInCommentArea("this is the second line.");
    chatPanel.clickPostCommentButton();
    chatPanel.verifyCommentThreadLength(1);
    chatPanel.verifyCommentThreadContains("this is the first line.\nthis is the second line.");
  });
  it('verify user can use enter to send post', () => {
    chatPanel.typeInCommentArea("Send this comment after enter.");
    chatPanel.useEnterToPostComment();
    chatPanel.verifyCommentThreadLength(2);
    chatPanel.verifyCommentThreadContains("Send this comment after enter.");
  });
  it('verify user can delete a post', () => {
    chatPanel.getDeleteMessageButton().click();
    chatPanel.getDeleteConfirmModalButton().contains("Delete").click();
    cy.wait(1000);
    chatPanel.verifyCommentThreadLength(1);
    chatPanel.verifyCommentThreadDoesNotContain("Send this comment after enter.");
  });
  it("verify commenting on document only shows document comment", () => {
    cy.openTopTab("problems");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentAndVerify("This is a document comment");
    cy.clickProblemResourceTile('introduction');
    chatPanel.addCommentAndVerify("This is a tile comment for the first tile");
    cy.clickProblemResourceTile('introduction', 3);
    chatPanel.addCommentAndVerify("This is the 4th tile comment.");
  });
  it("verify commenting on tile only shows tile comment", () => {
    chatPanel.showAndVerifyTileCommentClass(3);
    chatPanel.verifyCommentThreadDoesNotContain("This is a document comment");
    chatPanel.verifyCommentThreadDoesNotContain("This is a tile comment for the first tile");
    chatPanel.verifyCommentThreadContains("This is the 4th tile comment.");
    cy.clickProblemResourceTile('introduction');
    chatPanel.showAndVerifyTileCommentClass();
    chatPanel.verifyCommentThreadDoesNotContain("This is a document comment");
    chatPanel.verifyCommentThreadContains("This is a tile comment for the first tile");
    chatPanel.verifyCommentThreadDoesNotContain("This is the 4th tile comment.");
  });
  it("verify clicking problem section tab shows document comment", () => {
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyTileCommentDoesNotHaveClass();
    chatPanel.verifyCommentThreadContains("This is a document comment");
    chatPanel.verifyCommentThreadDoesNotContain("This is a tile comment for the first tile");
    chatPanel.verifyCommentThreadDoesNotContain("This is the 4th tile comment.");
  });
  it("verify document is selected when switching between tabs", () => {
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
});
describe('Chat panel for all resources', () => {
  it("verify chat is available on Problem section - Introduction tab", () => {
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for problems-section introduction-subsection");
    // click first tile
    cy.clickProblemResourceTile('introduction');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for problems-section introduction-subsection");
  });
  it("verify chat is available on Problem section - Initial Challenge tab", () => {
    cy.openTopTab("problems");
    cy.openProblemSection("Initial Challenge");
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for problems-section initial-challenge-subsection");
    // click first tile
    cy.clickProblemResourceTile('initialChallenge');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for problems-section initial-challenge-subsection");
  });
  it("verify chat is available on Problem section - What If... tab", () => {
    cy.openTopTab("problems");
    cy.openProblemSection("What If...?");
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for problems-section what-if-subsection");
    // click first tile
    cy.clickProblemResourceTile('whatIf');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for problems-section what-if-subsection");
  });
  it("verify chat is available on Problem section - Now What Do You Know? tab", () => {
    cy.openTopTab("problems");
    cy.openProblemSection("Now What Do You Know?");
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for problems-section now-what-subsection");
    // click first tile
    cy.clickProblemResourceTile('nowWhatDoYouKnow');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for problems-section now-what-subsection");
  });
  it("verify chat is available on Teacher Guide section - Overview tab", () => {
    cy.openTopTab("teacher-guide");
    cy.openProblemSection('Overview');
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section overview-subsection");
    // click first tile
    cy.clickProblemResourceTile('overview');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section overview-subsection");
  });
  it("verify chat is available on Teacher Guide section - Launch tab", () => {
    cy.openTopTab("teacher-guide");
    cy.openProblemSection('Launch');
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section launch-subsection");
    // click first tile
    cy.clickProblemResourceTile('launch');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section launch-subsection");
  });
  it("verify chat is available on Teacher Guide section - Explore tab", () => {
    cy.openTopTab("teacher-guide");
    cy.openProblemSection('Explore');
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section explore-subsection");
    // click first tile
    cy.clickProblemResourceTile('explore');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section explore-subsection");
  });
  it("verify chat is available on Teacher Guide section - Summarize tab", () => {
    cy.openTopTab("teacher-guide");
    cy.openProblemSection('Summarize');
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section summarize-subsection");
    // click first tile
    cy.clickProblemResourceTile('summarize');
    // tile comment
    chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section summarize-subsection");
  });
  it("verify chat is available on My Work section - Workspaces tab", () => {
    clueCanvas.getInvestigationCanvasTitle().text().then((title)=>{
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'workspaces');
      cy.openDocumentThumbnail('workspaces', title);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for teacher-my-work workspaces-subsection");
    });
  });
  it("verify chat is available on My Work section - Learning Log tab", () => {
    cy.openTopTab('my-work');
    cy.openSection('my-work', 'learning-log');
    cy.openDocumentWithIndex('my-work', 'learning-log', 0);
    // document comment
    chatPanel.addCommentAndVerify("This is document comment for teacher-my-work learning-log-subsection");
  });
});
describe('Teachers can communicate back and forth in chat panel', () => {
  it("verify teacher7 can post document and tile comments", () => {
    // Teacher 7 document comment
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentAndVerify("This is a teacher7 document comment");
    // Teacher 7 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.addCommentAndVerify("This is a teacher7 tile comment");
  });
  it("verify teacher8 can open clue chat in the same network", () => {
    // Open clue chat for Teacher 8
    cy.visit("/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:8&unit=msa&network=foo");
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
    resourcesPanel.getCollapsedResourcesTab().click();
    cy.openTopTab("problems");
    chatPanel.getChatPanelToggle().click();
  });
  it("verify teacher8 can view teacher7's comments and add more comments", () => {
    // Teacher 8 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher7 document comment");
    chatPanel.addCommentAndVerify("This is a teacher8 document comment");
    // Teacher 8 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains("This is a teacher7 tile comment");
    chatPanel.addCommentAndVerify("This is a teacher8 tile comment");
  });
  it("verify reopening teacher7's clue chat in the same network", () => {
    // Open clue chat for Teacher 7
    cy.visit("/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo");
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
    resourcesPanel.getCollapsedResourcesTab().click();
    cy.openTopTab("problems");
    chatPanel.getChatPanelToggle().click();
  });
  it("verify teacher7 can view teacher8's comments", () => {
    // Teacher 7 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher8 document comment");
    // Teacher 7 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains("This is a teacher8 tile comment");
  });
});
