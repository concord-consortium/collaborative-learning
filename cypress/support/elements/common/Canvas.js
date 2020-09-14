import Dialog from "./Dialog";

const dialog = new Dialog;

class Canvas{
    canvas(){
        return cy.get('.single-workspace:first');
    }

    singleCanvas(){
        return '[data-test=canvas]';
    }

    getSingleCanvas(){
        return cy.get(this.singleCanvas());
    }

    getSingleCanvasDocumentContent(){
        return cy.get('[data-test=canvas]:first .document-content');
    }

    //Header elements
    personalDocTitleEl(){
        return '[data-test=personal-doc-title]';
    }

    getPersonalDocTitle(){
        return cy.get(this.personalDocTitleEl());
    }

    getFileMenu() {
        return cy.get('[data-test=document-file-menu-header');
    }

    getOpenDocumentItem() {
        return this.getFileMenu().click()
            .then(() => {
                return cy.get('[data-test=list-item-icon-open-workspace');
            });
    }

    getCopyDocumentItem() {
        return this.getFileMenu().click()
            .then(() => {
                return cy.get('[data-test=list-item-icon-copy-workspace');
            });
    }

    getDeleteDocumentItem() {
        return this.getFileMenu().click()
            .then(() => {
                return cy.get('[data-test=list-item-icon-delete-workspace');
            });
    }

    getPublishIcon(){
        return cy.get('[data-test=publish-icon]');
    }

    getPersonalPublishIcon(){
        return cy.get('[data-test=other-doc-publish-icon]');
    }

    getEditTitleIcon(){
        return cy.get('[data-test=personal-doc-title] [data-test=edit-icon]');
    }

    createNewExtraDocument(title){
        this.getOpenDocumentItem().click()
            .then(function() {
                cy.get('.tab-panel-documents-section.personal-documents .new-document-button').click()
                    .then(function() {
                        dialog.getDialogTitle().should('exist').contains('Create Extra Workspace');
                        dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                        dialog.getDialogOKButton().click()
                            .then(function() {
                                this.getPersonalDocTitle().should("contain",title);
                            }.bind(this));
                    }.bind(this));
            }.bind(this));
    }

    openDocumentWithTitle(subTab, title){
        const subTabSelector = '.primary-workspace .doc-tab.my-work.' + subTab;
        const panelSelector = '.primary-workspace .tab-panel-documents-section.' + subTab;
        const titlesSelector = panelSelector + ' .list.my-work .list-item .footer';
        this.getOpenDocumentItem().click()
            .then(()=>{
                cy.get(subTabSelector).click()
                    .then(() => {
                        cy.contains(titlesSelector, title).click();
                    });
            });
    }

    editTitlewithPencil(title){
        this.getEditTitleIcon().click()
            .then(function(){
                dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            });
    }

    editTitle(title){
        this.getPersonalDocTitle().find('#titlebar-title').click()
            .then(function(){
                dialog.getDialogTitle().should('exist').contains('Rename Extra Workspace');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            });
    }

    copyDocument(title){
        this.getCopyDocumentItem().click()
            .then(function(){
                dialog.getDialogTitle().should('exist').contains('Copy Problem Workspace');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            });
    }

    copyExtraDocument(title){
        this.getCopyDocumentItem().click()
            .then(function(){
                dialog.getDialogTitle().should('exist').contains('Copy Extra Workspace');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            });
    }

    deleteDocument(){
        this.getDeleteDocumentItem().click().then(()=>{
            dialog.getDialogTitle().should('exist').contains('Delete ');
            dialog.getDialogOKButton().click();
        });
    }

    publishPersonalCanvas(){
        this.getPersonalPublishIcon().click()
            .then(()=>{
                dialog.getDialogTitle().should('exist').contains('Publish ');
                dialog.getDialogOKButton().click();
                dialog.getDialogTitle().should('exist').contains('Published');
                dialog.getDialogOKButton().click();
                dialog.getDialogTitle().should('not.exist');
                this.getPersonalPublishIcon().should('exist');
            });
    }
    publishCanvas(){
        this.getPublishIcon().click()
            .then(()=>{
                dialog.getDialogTitle().should('exist').contains('Publish ');
                dialog.getDialogOKButton().click();
                dialog.getDialogTitle().should('exist').contains('Published');
                dialog.getDialogOKButton().click();
                dialog.getDialogTitle().should('not.exist');
                this.getPublishIcon().should('exist');
            });
    }

    scrollToBottom(element){
        element.scrollTo('bottom');
    }

    scrollToTop(element){
        element.scrollTo('top');
    }
}

export default Canvas;
