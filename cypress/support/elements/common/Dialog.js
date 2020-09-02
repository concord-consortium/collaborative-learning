class Dialog{// popup dialog box
    getDialogTitle(){
        return cy.get('[data-test=dialog-title]');
    }

    getDialogTextInput(){
        return cy.get('[data-test=dialog-text-input]');
    }

    getDialogOKButton(){
        return cy.get('[data-test=dialog-buttons] #okButton');
    }

    getDialogCancelButton(){
        return cy.get('[data-test=dialog-buttons] #cancelButton');
    }

}
export default Dialog;
