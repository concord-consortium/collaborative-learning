class TextToolTile {
    getTextEditor(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .text-tool-editor`);
    }
    getTextTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .text-tool`);
    }
    verifyTextTileIsEditable(){
      cy.wait(500);
      expect(this.getTextTile).to.exist;
      this.getTextTile().last().should('not.have.class', 'read-only');
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

    // Helper functions for text highlighting functionality
    getHighlightChip() {
        return cy.get('.primary-workspace [data-testid=ccrte-editor] .slate-highlight-chip');
    }

    getHighlightChipText() {
        return this.getHighlightChip().find('.highlight-chip-text');
    }

    getSelectedHighlightChip() {
        return cy.get('.primary-workspace [data-testid=ccrte-editor] .slate-highlight-chip.selected');
    }

    clickHighlightChip(index = 0) {
        this.getHighlightChip().eq(index).click();
    }

    verifyHighlightChipExists(expectedText) {
        this.getHighlightChip().should('exist');
        this.getHighlightChipText().should('contain', expectedText);
    }

    verifyHighlightChipNotExists() {
        this.getHighlightChip().should('not.exist');
    }

    verifyHighlightChipSelected(index = 0) {
        this.getSelectedHighlightChip().should('exist');
        this.getHighlightChip().eq(index).should('have.class', 'selected');
    }

    verifyHighlightChipNotSelected() {
        this.getSelectedHighlightChip().should('not.exist');
    }

    verifyHighlightToolbarButtonEnabled() {
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.highlight').should('not.be.disabled');
    }

    verifyHighlightToolbarButtonDisabled() {
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.highlight').should('be.disabled');
    }

    clickHighlightToolbarButton() {
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.highlight').click();
    }

    verifyOtherToolbarButtonsDisabled() {
        // Verify that other toolbar buttons are disabled when highlight chip is selected
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.bold').should('be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.italic').should('be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.underline').should('be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.subscript').should('be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.superscript').should('be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.list-ol').should('be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.list-ul').should('be.disabled');
    }

    verifyOtherToolbarButtonsEnabled() {
        // Verify that other toolbar buttons are enabled when no highlight chip is selected
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.bold').should('not.be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.italic').should('not.be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.underline').should('not.be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.subscript').should('not.be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.superscript').should('not.be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.list-ol').should('not.be.disabled');
        cy.get('.tile-toolbar.text-toolbar .toolbar-button.list-ul').should('not.be.disabled');
    }

    getHighlightButton() {
        return cy.get('[data-testid="text-highlight-button"]');
    }
}
export default TextToolTile;
