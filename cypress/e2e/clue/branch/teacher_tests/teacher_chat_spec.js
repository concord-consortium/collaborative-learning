import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import ChatPanel from "../../../../support/elements/clue/ChatPanel";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;
let chatPanel = new ChatPanel;

let selectedChatBackground = 'rgb(247, 251, 199)';
let expandedChatBackground = 'rgb(234, 242, 142)';

const queryParams = {
  teacherQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa",
  teacher7NetworkQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo",
  teacher8NetworkQueryParams: "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:8&unit=msa&network=foo"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
}

function loadNetworkTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  cy.openTopTab("problems");
  chatPanel.getChatPanelToggle().should('exist');
}

context('Chat Panel', () => {
  beforeEach(() => {
    cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
  });

  describe('Chat panel for networked teacher', () => {
    it('verify chat panel', () => {
      cy.log('verify chat panel is accessible if teacher is in network (via url params)');
      beforeTest(queryParams.teacherQueryParams);
      loadNetworkTest(queryParams.teacher7NetworkQueryParams);
    
      cy.log('verify chat panel opens');
      chatPanel.getChatPanelToggle().click();
      chatPanel.getChatPanel().should('exist');
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
      chatPanel.addCommentAndVerify(documentComment1);
    
      cy.log('verify teacher name and initial appear on comment correctly');
      chatPanel.getUsernameFromCommentHeader().should('contain', "Teacher 7");
    
      cy.log('verify workspace tab document is highlighted');
      clueCanvas.getInvestigationCanvasTitle().text().then((title)=>{
        cy.openTopTab('my-work');
        cy.openSection('my-work', 'workspaces');
        cy.openDocumentThumbnail('my-work','workspaces', title);
        chatPanel.verifyDocumentCommentClass();
      });
    
      cy.log("verify escape key empties textarea");
      chatPanel.typeInCommentArea("this should be erased. {esc}");
      chatPanel.verifyCommentAreaContains("");
      chatPanel.verifyCommentThreadDoesNotExist();
    
      cy.log('verify user can use shift+enter to go to the next line and not post');
      chatPanel.typeInCommentArea("this is the first line. {shift}{enter}");
      chatPanel.verifyCommentThreadDoesNotExist();
      chatPanel.typeInCommentArea("this is the second line.");
      chatPanel.clickPostCommentButton();
      chatPanel.verifyCommentThreadLength(1);
      chatPanel.verifyCommentThreadContains("this is the first line.\nthis is the second line.");
    
      cy.log('verify user can use enter to send post');
      chatPanel.typeInCommentArea("Send this comment after enter.");
      chatPanel.useEnterToPostComment();
      chatPanel.verifyCommentThreadLength(2);
      chatPanel.verifyCommentThreadContains("Send this comment after enter.");
    
      cy.log('verify user can delete a post');
      const msgToDelete = "Send this comment after enter.";
      chatPanel.getDeleteMessageButton(msgToDelete).click();
      chatPanel.getDeleteConfirmModalButton().contains("Delete").click();
      cy.wait(2000);
      chatPanel.verifyCommentThreadLength(1);
      chatPanel.verifyCommentThreadDoesNotContain(msgToDelete);
    
      cy.log("verify commenting on document only shows document comment");
      cy.openTopTab("problems");
      chatPanel.verifyProblemCommentClass();
      chatPanel.addCommentAndVerify("This is a document comment");
      cy.clickProblemResourceTile('introduction');
      chatPanel.addCommentAndVerify("This is a tile comment for the first tile");
      cy.clickProblemResourceTile('introduction', 2);
      chatPanel.addCommentAndVerify("This is the 3rd tile comment.");
    
      cy.log("verify commenting on tile only shows tile comment");
      chatPanel.showAndVerifyTileCommentClass(3);
      chatPanel.verifyCommentThreadDoesNotContain("This is a document comment");
      chatPanel.verifyCommentThreadDoesNotContain("This is a tile comment for the first tile");
      chatPanel.verifyCommentThreadContains("This is the 3rd tile comment.");
      cy.clickProblemResourceTile('introduction');
      chatPanel.showAndVerifyTileCommentClass();
      chatPanel.verifyCommentThreadDoesNotContain("This is a document comment");
      chatPanel.verifyCommentThreadContains("This is a tile comment for the first tile");
      chatPanel.verifyCommentThreadDoesNotContain("This is the 3rd tile comment.");
    
      cy.log("verify clicking problem section tab shows document comment");
      cy.openProblemSection("Introduction");
      chatPanel.verifyProblemCommentClass();
      chatPanel.verifyTileCommentDoesNotHaveClass();
      chatPanel.verifyCommentThreadContains("This is a document comment");
    
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
      
      cy.log("verify chat is available on Problem section - Introduction tab");
      cy.openTopTab("problems");
      cy.openProblemSection("Introduction");
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for problems-section introduction-subsection");
      // click first tile
      cy.clickProblemResourceTile('introduction');
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for problems-section introduction-subsection");
   
      cy.log("verify chat is available on Problem section - Initial Challenge tab");
      cy.openTopTab("problems");
      cy.openProblemSection("Initial Challenge");
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for problems-section initial-challenge-subsection");
      // click first tile
      cy.clickProblemResourceTile('initialChallenge');
      cy.wait(2000);
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for problems-section initial-challenge-subsection");
    
      cy.log("verify chat is available on Problem section - What If... tab");
      cy.openTopTab("problems");
      cy.openProblemSection("What If...?");
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for problems-section what-if-subsection");
      // click first tile
      cy.clickProblemResourceTile('whatIf');
      cy.wait(2000);
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for problems-section what-if-subsection");
    
      cy.log("verify chat is available on Problem section - Now What Do You Know? tab");
      cy.openTopTab("problems");
      cy.openProblemSection("Now What Do You Know?");
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for problems-section now-what-subsection");
      // click first tile
      cy.clickProblemResourceTile('nowWhatDoYouKnow');
      cy.wait(2000);
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for problems-section now-what-subsection");
    
    // it.skip("verify chat is available on Teacher Guide section - Unit Plan tab", () => {
    //   cy.openTopTab("teacher-guide");
    //   cy.openProblemSection('Unit Plan');
    //   cy.wait(2000);
    //   // document comment
    //   chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section unit-plan-subsection");
    //   // click first tile
    //   cy.clickProblemResourceTile('unitPlan');
    //   cy.wait(2000);
    //   // tile comment
    //   chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section unit-plan-subsection");
    // });
      cy.log("verify chat is available on Teacher Guide section - Launch tab");
      cy.openTopTab("teacher-guide");
      cy.openProblemSection('Launch');
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section launch-subsection");
      // click first tile
      cy.clickProblemResourceTile('launch');
      cy.wait(2000);
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section launch-subsection");
    
      cy.log("verify chat is available on Teacher Guide section - Explore tab");
      cy.openTopTab("teacher-guide");
      cy.openProblemSection('Explore');
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section explore-subsection");
      // click first tile
      cy.clickProblemResourceTile('explore');
      cy.wait(2000);
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section explore-subsection");
    
      cy.log("verify chat is available on Teacher Guide section - Summarize tab");
      cy.openTopTab("teacher-guide");
      cy.openProblemSection('Summarize');
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for teacher-guide-section summarize-subsection");
      // click first tile
      cy.clickProblemResourceTile('summarize');
      cy.wait(2000);
      // tile comment
      chatPanel.addCommentAndVerify("This is tile comment for teacher-guide-section summarize-subsection");
    
      cy.log("verify chat is available on My Work section - Workspaces tab");
      clueCanvas.getInvestigationCanvasTitle().text().then((title)=>{
        cy.openTopTab('my-work');
        cy.openSection('my-work', 'workspaces');
        cy.openDocumentThumbnail('my-work','workspaces', title);
        cy.wait(2000);
        // document comment
        chatPanel.addCommentAndVerify("This is document comment for teacher-my-work workspaces-subsection");
      });
    
      cy.log("verify chat is available on My Work section - Learning Log tab");
      cy.openTopTab('my-work');
      cy.openSection('my-work', 'learning-log');
      cy.openDocumentWithIndex('my-work', 'learning-log', 0);
      cy.wait(2000);
      // document comment
      chatPanel.addCommentAndVerify("This is document comment for teacher-my-work learning-log-subsection");
    });

    it("Teachers can communicate back and forth in chat panel", () => {
      cy.log("verify teacher7 can post document and tile comments");
      beforeTest(queryParams.teacherQueryParams);
      loadNetworkTest(queryParams.teacher7NetworkQueryParams);
      // Teacher 7 document comment
      cy.openTopTab("problems");
      cy.openProblemSection("Introduction");
      chatPanel.getChatPanelToggle().click();
      chatPanel.verifyProblemCommentClass();
      cy.wait(2000);
      chatPanel.addCommentAndVerify("This is a teacher7 document comment");
      // Teacher 7 tile comment
      cy.clickProblemResourceTile('introduction');
      cy.wait(2000);
      chatPanel.addCommentAndVerify("This is a teacher7 tile comment");
    
      cy.log("verify teacher8 can open clue chat in the same network");
      // Open clue chat for Teacher 8
      loadNetworkTest(queryParams.teacher8NetworkQueryParams);
      chatPanel.getChatPanelToggle().click();
    
      cy.log("verify teacher8 can view teacher7's comments and add more comments");
      // Teacher 8 document comment
      chatPanel.verifyProblemCommentClass();
      chatPanel.verifyCommentThreadContains("This is a teacher7 document comment");
      chatPanel.addCommentAndVerify("This is a teacher8 document comment");
      // Teacher 8 tile comment
      cy.clickProblemResourceTile('introduction');
      cy.wait(2000);
      chatPanel.verifyCommentThreadContains("This is a teacher7 tile comment");
      chatPanel.addCommentAndVerify("This is a teacher8 tile comment");
    
      cy.log("verify reopening teacher7's clue chat in the same network");
      // Open clue chat for Teacher 7
      loadNetworkTest(queryParams.teacher7NetworkQueryParams);
      chatPanel.getChatPanelToggle().click();
    
      cy.log("verify teacher7 can view teacher8's comments");
      // Teacher 7 document comment
      chatPanel.verifyProblemCommentClass();
      chatPanel.verifyCommentThreadContains("This is a teacher8 document comment");
      // Teacher 7 tile comment
      cy.clickProblemResourceTile('introduction');
      cy.wait(2000);
      chatPanel.verifyCommentThreadContains("This is a teacher8 tile comment");
    });
 });
});
