class TextToolTile {
    getTextEditor(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .text-tool-editor`);
    }
    getTextTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .text-tool`);
    }
    enterText(text){
        this.getTextTile().last().focus();
        this.getTextEditor().last().click();
        this.getTextEditor().last().type(text);
        // This doesn't guarantee the text has been saved to firebase. It would be best
        // if there was a way to tell if it has been saved perhaps by some saving indicator
        // in the UI. Or reaching into app to find some saving state.
        // In the meantime a short wait is added to decrease the chances this might happen
        cy.wait(300);
    }
    enterAdditionalText(text){
        this.getTextTile().last().focus();
        this.getTextEditor().last().type('{moveToEnd}'+text);
        cy.wait(300);
    }

    deleteText(text){
        this.getTextTile().last().type(text);
    }

    getVariableChip() {
      return cy.get('.primary-workspace [data-testid=ccrte-editor] .slate-variable-chip .variable-chip');
    }
    deleteTextTile() {
        this.getTextTile().last().click();
        cy.get('.tool.delete').click();
        cy.get('.ReactModalPortal .modal-footer .modal-button.default').click();
    }
}
export default TextToolTile;
