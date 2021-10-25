const DOCUMENT_COMMENT_CLASS = 'comment-select';
const TILE_COMMENT_CLASS = 'selected-for-comment';

class ChatPanel{

    getChatPanelToggle() {
      return cy.get('.chat-panel-toggle');
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
    getCommentCardHeaderIcon() {
      return cy.get('[data-testid=comment-card-header-icon]');
    }
    getCommentTextArea() {
      return cy.get('[data-testid=comment-textarea]');
    }
    getCommentPostButton(){
      return cy.get('[data-testid=comment-post-button]');
    }
    getCommentCardContent() {
      return cy.get('[data-testid=comment-card-content]');
    }
    getCommentCancelButton(){
      return cy.get('[data-testid=comment-cancel-button]');
    }
    getCommentFromThread() {
      return cy.get('[data-testid=comment-thread] [data-testid=comment]');
    }
    getUsernameFromCommentHeader() {
      return cy.get('.comment-text-header .user-name');
    }
    getDeleteMessageButton() {
      return cy.get("[data-testid=delete-message-button]").last();
    }
    getDeleteConfirmModalButton() {
      return cy.get(".confirm-delete-alert .modal-button");
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
      cy.get("[data-testid=comment-textarea]").type(commentText);
    }
    clickPostCommentButton() {
      cy.get("[data-testid=comment-post-button]").click();
      cy.wait(5000);
    }
    useEnterToPostComment() {
      this.typeInCommentArea("{enter}");
      cy.wait(5000);
    }
    addCommentAndVerify(commentText) {
      this.typeInCommentArea(commentText);
      this.getCommentTextArea().should('contain', commentText);
      this.clickPostCommentButton();
      this.getCommentFromThread().should('contain', commentText);
    }
    verifyProblemCommentClass() {
      this.getProblemDocumentContent().should('have.class', DOCUMENT_COMMENT_CLASS);
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
      this.getCommentTextArea().should('contain', commentText);
    }
    verifyCommentAreaDoesNotContain(commentText) {
      this.getCommentTextArea().should('not.contain', commentText);
    }
    verifyCommentThreadLength(length) {
      this.getCommentFromThread().should("have.length", length);
    }
    verifyCommentThreadContains(commentText) {
      this.getCommentFromThread().should("contain", commentText);
    }
    verifyCommentThreadDoesNotContain(commentText) {
      this.getCommentFromThread().should("not.contain", commentText);
    }
    verifyCommentThreadDoesNotExist() {
      this.getCommentFromThread().should("not.exist");
    }
}
export default ChatPanel;
