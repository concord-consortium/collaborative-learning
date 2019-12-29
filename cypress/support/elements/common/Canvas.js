import Dialog from "./Dialog";

const dialog = new Dialog

class Canvas{
    canvas(){
        return cy.get('.single-workspace:first');
    }

    singleCanvas(){
        return '[data-test=canvas]'
    }

    getSingleCanvas(){
        return cy.get(this.singleCanvas());
    }

    getSingleCanvasDocumentContent(){
        return cy.get('[data-test=canvas]:first .document-content')
    }

    //Header elements
    personalDocTitleEl(){
        return '[data-test=personal-doc-title]'
    }

    getPersonalDocTitle(){
        return cy.get(this.personalDocTitleEl())
    }

    getNewDocumentIcon(){
        return cy.get('[data-test=new-icon]')
    }

    getPublishIcon(){
        return cy.get('[data-test=publish-icon]');
    }

    getPersonalPublishIcon(){
        return cy.get('[data-test=other-doc-publish-icon]');
    }

    getEditTitleIcon(){
        return cy.get('[data-test=personal-doc-title] [data-test=edit-icon]')
    }

    getCopyIcon(){
        return cy.get('[data-test=copy-icon]')
    }

    getDeleteIcon(){
        return cy.get('[data-test=delete-icon]')
    }

    createNewProblemDocument(title){
        this.getNewDocumentIcon().click()
            .then(()=>{
                dialog.getDialogTitle().should('exist').contains('Create Problem Workspace');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            })
        cy.wait(3000)    
    }
    createNewExtraDocument(title){
        this.getNewDocumentIcon().click()
            .then(()=>{
                //dialog.getDialogTitle().should('exist').and('contains','Create Extra Workspace'); //cannot be too specific because of difference bet. CLUE and Dataflow
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            })
        cy.wait(3000)    
    }

    editTitle(title){
        this.getEditTitleIcon().click()
            .then(function(){
                dialog.getDialogTitle().should('exist').and('contain','Rename');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click();
            })
    }

    copyDocument(title){
        this.getCopyIcon().click()
            .then(function(){
                dialog.getDialogTitle().should('exist').and('contain','Copy');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click(); 
            })
    }

    copyExtraDocument(title){
        this.getCopyIcon().click()
            .then(function(){
                dialog.getDialogTitle().should('exist').contains('Copy Extra Workspace');
                dialog.getDialogTextInput().click().type('{selectall}{backspace}'+title);
                dialog.getDialogOKButton().click(); 
            })
    }

    deleteDocument(){
        this.getDeleteIcon().click().then(()=>{
            dialog.getDialogTitle().should('exist').contains('Delete Workspace');
            dialog.getDialogOKButton().click();
        })
    cy.wait(3000)    
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