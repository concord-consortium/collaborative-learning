import Dialog from "./Dialog";

const dialog = new Dialog;

class Canvas {
  canvas() {
    return cy.get('.single-workspace:first');
  }

  singleCanvas() {
    return '[data-test=canvas]';
  }

  getSingleCanvas() {
    return cy.get(this.singleCanvas());
  }

  getSingleCanvasDocumentContent() {
    return cy.get('[data-test=canvas]:first .document-content');
  }

  //Header elements
  personalDocTitleEl() {
    return '[data-test=personal-doc-title]';
  }

  getPersonalDocTitle() {
    return cy.get(this.personalDocTitleEl());
  }

  getFileMenu() {
    return cy.get('[data-test=document-file-menu-header');
  }

  openFileMenu() {
    this.getFileMenu().click();
  }

  copyDocumentFromFileMenu() {
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-copy-workspace').click();
  }

  getDeleteDocumentItem() {
    return cy.get('[data-test=list-item-icon-delete-workspace');
  }

  getPublishIcon() {
    return cy.get('[data-test=publish-icon]');
  }

  getPersonalPublishIcon() {
    return cy.get('[data-test=other-doc-publish-icon]');
  }

  getEditTitleIcon() {
    return cy.get('[data-test=personal-doc-title] [data-test=edit-icon]');
  }

  createNewExtraDocumentFromFileMenu(title, type) {
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-open-workspace]').click();
    cy.get('.primary-workspace .doc-tab.my-work.workspaces').click();
    cy.get('[data-test=' + type + '-section-workspaces-documents] [data-test=my-work-new-document]').click();
    dialog.getDialogTitle().should('exist').contains('Create Extra Workspace');
    dialog.getDialogTextInput().click().clear().type(title);
    dialog.getDialogOKButton().click();
  }

  openDocumentWithTitle(subTab, title) {
    const subTabSelector = '.primary-workspace .doc-tab.my-work.' + subTab;
    const panelSelector = '.primary-workspace .tab-panel-documents-section.' + subTab;
    const titlesSelector = panelSelector + ' .list.my-work .list-item .footer';
    this.getOpenDocumentItem().click()
      .then(() => {
        cy.get(subTabSelector).click()
          .then(() => {
            cy.contains(titlesSelector, title).click();
          });
      });
  }

  editTitlewithPencil(title) {
    this.getEditTitleIcon().click()
      .then(function () {
        dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
        dialog.getDialogTextInput().click().type('{selectall}{backspace}' + title);
        dialog.getDialogOKButton().click();
      });
  }

  editTitle(title) {
    this.getPersonalDocTitle().find('#titlebar-title').click()
      .then(function () {
        dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
        dialog.getDialogTextInput().click().type('{selectall}{backspace}' + title);
        dialog.getDialogOKButton().click();
      });
  }

  copyDocument(title) {
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-copy-workspace]').click();
    dialog.getDialogTitle().should('exist').contains('Copy');
    dialog.getDialogTextInput().click().clear().type(title);
    dialog.getDialogOKButton().click();
  }

  deleteDocument() {
    this.openFileMenu();
    this.getDeleteDocumentItem().click();
    dialog.getDialogTitle().should('exist').contains('Delete ');
    dialog.getDialogOKButton().click();
  }

  publishCanvas(type) {
    if (type==="personal") {
      this.getPersonalPublishIcon().click();
    } else {
      this.getPublishIcon().click();
    }
    dialog.getDialogTitle().should('exist').contains('Publish ');
    dialog.getDialogOKButton().click();
    dialog.getDialogTitle().should('exist').contains('Published');
    dialog.getDialogOKButton().click();
    dialog.getDialogTitle().should('not.exist');
  }

  scrollToBottom(element) {
    element.scrollTo('bottom');
  }

  scrollToTop(element) {
    element.scrollTo('top');
  }
}

export default Canvas;
