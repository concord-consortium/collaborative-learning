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
    }

    deleteText(text){
        this.getTextTile().last().type(text);
    }
}
export default TextToolTile;
