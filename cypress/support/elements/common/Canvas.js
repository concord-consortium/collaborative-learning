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

  getPublishItem() {
    this.openFileMenu();
    return cy.get('[data-test=list-item-icon-publish-workspace]');
  }

  getEditTitleIcon() {
    return cy.get('[data-test=personal-doc-title] [data-test=edit-icon]');
  }
  // the force:true assertions on lines 63-68 are likely needed because of the
  // Jira ticket:https://concord-consortium.atlassian.net/browse/CLUE-81
  // Once that's fixed we can remove the force:true assertions
  createNewExtraDocumentFromFileMenu(title, type) {
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-open-workspace]').click();
    cy.get('.primary-workspace .doc-tab.my-work.workspaces').click();
    cy.get('[data-test=' + type + '-section-workspaces-documents] [data-test=my-work-new-document]').click();
    dialog.getDialogTitle().should('exist').contains('Create Extra Workspace');
    dialog.getDialogTextInput()
      .click({force: true})
      .wait(100)
      .type('{selectall}{backspace}' + title, {force: true});
    dialog.getDialogOKButton().click();
  }
  // the force:true assertions on line 76-79 are likely needed because of the
  // Jira ticket:https://concord-consortium.atlassian.net/browse/CLUE-81
  // Once that's fixed we can remove the force:true assertions
  createNewExtraDocumentFromFileMenuWithoutTabs(title, type) {
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-open-workspace]').click();
    cy.get('[data-test=' + type + '-section-workspaces-documents] [data-test=my-work-new-document]').click();
    dialog.getDialogTitle().should('exist');
    dialog.getDialogTextInput().click({force: true}).clear().type(title);
    dialog.getDialogOKButton().click();
  }

  openDocumentWithTitle(subTab, title) {
    const subTabSelector = '.primary-workspace .doc-tab.my-work.' + subTab;
    const panelSelector = '.primary-workspace .tab-panel-documents-section.' + subTab;
    const titlesSelector = panelSelector + ' .list-item .footer';

    this.openFileMenu();
    cy.get('[data-test=list-item-icon-open-workspace]').click();
    cy.get(subTabSelector).click();
    cy.get(titlesSelector).contains(title).click();
  }

  openDocumentWithTitleWithoutTabs(title) {
    const panelSelector = '.primary-workspace .tab-panel-documents-section';
    const titlesSelector = panelSelector + ' .list-item .footer';

    this.openFileMenu();
    cy.get('[data-test=list-item-icon-open-workspace]').click();
    cy.get(titlesSelector).contains(title).click();
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
    dialog.getDialogTextInput().invoke('val').should('match', /^Copy of.*/);
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
    this.getPublishItem().click({force:true});
    dialog.getModalTitle().should('exist').contains('Publish ');
    dialog.getModalButton().contains("OK").click();
    dialog.getDialogTitle().should('exist').contains('Published');
    dialog.getDialogOKButton().click();
    dialog.getDialogTitle().should('not.exist');
    cy.wait(5000);
  }

  scrollToBottom(element) {
    element.scrollTo('bottom');
  }

  scrollToTop(element) {
    element.scrollTo('top');
  }
}

export default Canvas;
