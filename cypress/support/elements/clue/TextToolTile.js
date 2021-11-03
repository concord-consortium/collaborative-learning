class TextToolTile {
    getTextEditor(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .text-tool-editor`);
    }
    getTextTile(workspaceClass){
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .text-tool`);
    }
    enterText(text){
        this.getTextTile().last().focus();
        this.getTextEditor().last().type(text);
        // This doesn't guarantee the text has been saved to firebase. It would be best
        // if there was a way to tell if it has been saved perhaps by some saving indicator
        // in the UI. Or reaching into app to find some saving state.
        // In the meantime a short wait is added to decrease the chances this might happen
        cy.wait(300);
    }

    deleteText(text){
        this.getTextTile().last().type(text);
    }
}
export default TextToolTile;
