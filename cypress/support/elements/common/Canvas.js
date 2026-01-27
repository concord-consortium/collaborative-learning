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

  createNewExtraDocumentFromFileMenu(title, type,) {
    cy.log('Creating new extra document: ' + title + ' in type: ' + type);
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-open-workspace]').click();
    cy.get('.primary-workspace .doc-tab.my-work.workspaces').click();
    cy.get('[data-test=' + type + '-section-workspaces-documents] [data-test=my-work-new-document]').click();
    dialog.getDialogTitle().should('exist').contains('Create Extra Workspace');

    // Wait for dialog to be ready and visible
    dialog.getDialogTextInput()
      .should('be.visible')
      .should('not.be.disabled')
      .click()
      .clear()
      .type(title);

    dialog.getDialogOKButton().click();

    // The only calls to this method use `my-work` as the type. I'm not sure
    // what the other types could be. I assume a different type might create a
    // a different kind of document, so the check below might fail. In order
    // to catch this kind of issue early, I'm adding this check.
    if (type !== 'my-work') {
      throw new Error('createNewExtraDocumentFromFileMenu only supports my-work type currently');
    }
    // Creating the document will open it. There can be a delay though.
    // If we don't wait for the document to be opened the test will continue
    // and when the document finally opens it can change the UI in a way the
    // tests don't expect.
    this.getPersonalDocTitle().should('contain', title);
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
        dialog.getDialogTextInput()
          .should('be.visible')
          .should('not.be.disabled')
          .click({force: true})
          .type('{selectall}{backspace}' + title, {force: true});
        dialog.getDialogOKButton().click();
      });
  }

  editTitle(title) {
    this.getPersonalDocTitle().find('#titlebar-title').click()
      .then(function () {
        dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
        dialog.getDialogTextInput()
          .should('be.visible')
          .should('not.be.disabled')
          .click({force: true})
          .type('{selectall}{backspace}' + title, {force: true});
        dialog.getDialogOKButton().click();
      });
  }

  copyDocument(title) {
    this.openFileMenu();
    cy.get('[data-test=list-item-icon-copy-workspace]').click();
    dialog.getDialogTitle().should('exist').contains('Copy');
    dialog.getDialogTextInput().invoke('val').should('match', /^Copy of.*/);

    // Wait for dialog to be ready and visible
    dialog.getDialogTextInput()
      .should('be.visible')
      .should('not.be.disabled')
      .click({force: true})
      .clear({force: true})
      .type(title, {force: true});

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

  // Toolbar selectors and methods
  getCopyButtons() {
    return cy.get('[data-testid="tool-copytoworkspace"], [data-testid="tool-copytodocument"]');
  }

  getCopyToWorkspaceButton() {
    return cy.get('[data-testid="tool-copytoworkspace"]');
  }

  getCopyToDocumentButton() {
    return cy.get('[data-testid="tool-copytodocument"]');
  }

  getSelectAllButton() {
    return cy.get('[data-testid="tool-selectall"]');
  }

  getTileDragHandles() {
    return cy.get('[data-testid="tool-tile-drag-handle"] .tool-tile-drag-handle');
  }

  verifyAllTilesSelected() {
    this.getTileDragHandles().each(($handle) => {
      cy.wrap($handle).should('have.class', 'selected');
    });
  }

  verifyNoTilesSelected() {
    this.getTileDragHandles().each(($handle) => {
      cy.wrap($handle).should('not.have.class', 'selected');
    });
  }

  getFourUpToolbarButton() {
    return cy.get('[data-testid="tool-fourup"]');
  }

  getFourUpToolbarButtonState() {
    return this.getFourUpToolbarButton().invoke('attr', 'class');
  }

  isFourUpToolbarButtonDisabled() {
    return this.getFourUpToolbarButtonState().should('contain', 'disabled');
  }

  isFourUpToolbarButtonEnabled() {
    return this.getFourUpToolbarButtonState().should('not.contain', 'disabled');
  }

  clickFourUpToolbarButton() {
    return this.getFourUpToolbarButton().click();
  }

  getIdeasButton() {
    return cy.get('[data-test=ideas-button]');
  }
}

export default Canvas;
