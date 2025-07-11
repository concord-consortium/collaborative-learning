const DOCUMENT_COMMENT_CLASS = 'comment-select';
const TILE_COMMENT_CLASS = 'selected-for-comment';

import TeacherDashboard from "./TeacherDashboard";

let dashboard = new TeacherDashboard;

class ChatPanel{

    getChatPanelToggle() {
      return cy.get('.chat-panel-toggle');
    }
    openChatPanel() {
      cy.get('.resource-and-chat-panel .top-row').then(topRow => {
        if(topRow.find(".chat-panel-toggle").length > 0) {
          this.getChatPanelToggle().click();
          cy.wait(10000);
        }
      });
    }
    getChatPanel() {
      return cy.get('.chat-panel');
    }
    getNotificationToggle() {
      return cy.get('.notification-toggle');
    }
    getChatCloseButton() {
      return cy.get('.chat-close-button');
    }
    getCommentCard() {
      return cy.get('[data-testid=comment-card]');
    }
    getCommentTileTypeIcon() {
      return cy.get('[data-testid=chat-thread-tile-type]');
    }
    getCommentTextArea() {
      return cy.get('.chat-thread-focused [data-testid=comment-textarea]');
    }
    getCommentPostButton(){
      return cy.get('[data-testid=comment-post-button]');
    }
    getCommentCardContent() {
      return cy.get('[data-testid=comment-card-content]');
    }
    getCommentCardLink() {
      return cy.get('[data-testid=comment-card-content] a');
    }
    getCommentCancelButton(){
      return cy.get('[data-testid=comment-cancel-button]');
    }
    getSelectedCommentThreadHeader(){
      return cy.get('.chat-thread-focused').find('[data-testid=chat-thread-header]');
    }
    getChatThread() {
      return cy.get('[data-testid=chat-thread]');
    }
    getFocusedThread() {
      return cy.get('.chat-thread-focused');
    }
    getCommentFromFocusedThread(message) {
      return this.getFocusedThread().find('[data-testid=comment-thread] [data-testid=comment]').contains(message);
    }
    getUsernameFromCommentHeader() {
      return cy.get('.comment-text-header .user-name');
    }
    getCommentThread(message) {
      return this.getCommentFromFocusedThread(message).parent();
    }
    getDeleteMessageButton(msgToDelete) {
      return this.getCommentFromFocusedThread(msgToDelete).parent().find("[data-testid=delete-message-button]");
    }
    getDeleteMessageButtonForUser(user) {
      return this.getUsernameFromCommentHeader().contains(user).siblings().find("[data-testid=delete-message-button]");
    }
    getDeleteConfirmModalButton() {
      return cy.get(".confirm-delete-alert .modal-button").contains("Delete");
    }
    getProblemDocumentContent() {
      return cy.get('.problem-panel [data-testid=document-content]');
    }
    getEditableDocumentContent() {
      return cy.get('.documents-panel .editable-document-content');
    }
    getToolTile(tileIndex = 0) {
      return cy.get('[data-testid=tool-tile]').eq(tileIndex);
    }
    typeInCommentArea(commentText) {
      // If the comment list is long, the text box is off screen so force.
      cy.get("[data-testid=comment-textarea]").scrollIntoView().type(commentText, {force: true});
      cy.wait(2000);
    }
    clickPostCommentButton() {
      // If the comment list is long, the button is off screen so force.
      cy.get("[data-testid=comment-post-button]").scrollIntoView().click({force: true});
      cy.wait(5000);
    }
    useEnterToPostComment() {
      this.typeInCommentArea("{enter}");
      cy.wait(5000);
    }
    addDocumentCommentAndVerify(commentText) {
      cy.get(".chat-thread-focused").invoke("attr", "class").should("contain", "chat-thread-document");
      this.typeInCommentArea(commentText);
      this.getCommentTextArea().should('contain', commentText);
      this.clickPostCommentButton();
      this.getFocusedThread().should('contain', commentText);
    }
    addTileCommentAndVerify(commentText) {
      cy.get(".chat-thread-focused").invoke("attr", "class").should("contain", "chat-thread-tile");
      this.typeInCommentArea(commentText);
      this.getCommentTextArea().should('contain', commentText);
      this.clickPostCommentButton();
      this.getFocusedThread().should('contain', commentText);
    }
    verifyProblemCommentClass() {
      this.getProblemDocumentContent().should('have.class', DOCUMENT_COMMENT_CLASS);
      cy.wait(1000);
    }
    verifyDocumentCommentClass() {
      this.getEditableDocumentContent().should('have.class',DOCUMENT_COMMENT_CLASS);
    }
    showAndVerifyTileCommentClass(tileIndex = 0) {
      cy.getToolTile(tileIndex).click().should('have.class', TILE_COMMENT_CLASS);
    }
    verifyTileCommentDoesNotHaveClass(tileIndex = 0) {
      cy.getToolTile(tileIndex).should('not.have.class', TILE_COMMENT_CLASS);
    }
    verifyCommentAreaContains(commentText) {
      this.getCommentTextArea().scrollIntoView().should('contain', commentText);
    }
    verifyCommentAreaDoesNotContain(commentText) {
      this.getCommentTextArea().scrollIntoView().should('not.contain', commentText);
    }
    verifyCommentThreadLength(length) {
      this.getFocusedThread().should("have.length", length);
    }
    verifyCommentThreadContains(commentText) {
      this.getFocusedThread().should("contain", commentText);
    }
    verifyCommentThreadDoesNotContain(commentText) {
      this.getChatPanel().should("not.contain", commentText);
    }
    verifyCommentThreadDoesNotExist() {
      this.getFocusedThread().should("not.exist");
    }

    openTeacherChat(portalUrl, teacher, reportUrl) {
      cy.login(portalUrl, teacher);
      cy.launchReport(reportUrl);
      cy.waitForLoad();
      dashboard.switchView("Workspace & Resources");
      // resourcesPanel.getCollapsedResourcesTab().click();
      this.getChatPanelToggle().click();
    }

    getCommentTextDropDown() {
      return cy.get('[data-test=comment-textbox-dropdown]');
    }
    getCommentTagFromThread() {
      return cy.get('[data-testid=comment-thread] .comment-dropdown-tag');
    }
    addCommentTagAndVerify(commentTag) {
      this.getCommentTextDropDown().select(commentTag);
      this.clickPostCommentButton();
      this.getCommentTagFromThread().should('contain', commentTag);
    }
    getCommentTagThread(tag) {
      return this.getCommentTagFromThread().contains(tag).parent();
    }
    getCommentTagDeleteMessageButton(tagToDelete) {
      return this.getCommentTagThread(tagToDelete).find("[data-testid=delete-message-button]");
    }
    verifyCommentTagThreadLength(length) {
      this.getCommentTagFromThread().should("have.length", length);
    }
    verifyCommentTagNotDisplayed(message) {
      this.getCommentThread(message).find(".comment-dropdown-tag").should("not.exist");
    }
    deleteCommentTagThread(tagToDelete) {
      this.getCommentTagDeleteMessageButton(tagToDelete).click({force:true});
      this.getDeleteConfirmModalButton().click();
      cy.wait(2000);
      this.getCommentTagFromThread().should("not.exist");
    }
    addCommentTagTextAndVerify(commentTag, commentText) {
      this.getCommentTextDropDown().select(commentTag);
      this.typeInCommentArea(commentText);
      this.getCommentTextArea().should('contain', commentText);
      this.clickPostCommentButton();
      this.getCommentTagFromThread().should('contain', commentTag);
      this.getFocusedThread().should('contain', commentText);
    }
    getDeleteCommentButton() {
      return cy.get(".chat-thread-focused [data-testid=delete-message-button]");
    }
    deleteTeacherComments() {
      let i;
      let totalCount;
      cy.get('body').then((body) => {
        if (body.find(".chat-thread-focused [data-testid=delete-message-button]").length > 0) {
          this.getDeleteCommentButton().then(((value) => {
            totalCount = Cypress.$(value).length;
            expect(value).to.have.length(totalCount);
            cy.log("Number of Comments: " + totalCount);
              for(i=totalCount; i > 0; i--) {
                this.getDeleteCommentButton().eq(i - 1).click();
                this.getDeleteConfirmModalButton().click();
                cy.wait(1000);
              }
            })
          );
        } else {
          cy.log("No Comments to Delete");
        }
      });
    }
    getCommentedDocumentList() {
      return this.getChatPanel().find('.commented-document-list');
    }
    documentCommentList() {
      let i;
      let totalCount;
      this.getNotificationToggle().click();
      cy.wait(3000);
      this.getCommentedDocumentList().find('.document-box').then(((value) => {
        totalCount = Cypress.$(value).length;
        expect(value).to.have.length(totalCount);
          for(i=0; i < totalCount; i++) {
            this.getCommentedDocumentList().find('.document-box').eq(i).click({ force: true });
            cy.wait(3000);
            this.addDocumentCommentAndVerify("This is " + (i+1) + " document list comment");
            this.getDeleteMessageButton("This is " + (i+1) + " document list comment").click({ force: true });
            this.getDeleteConfirmModalButton().click();
            this.getNotificationToggle().click();
            cy.wait(3000);
          }
        })
      );
    }
}
export default ChatPanel;
