class TextToolTile {
    getTextEditor(){
        return cy.get('.canvas-area .text-tool-editor');
    }
    getTextTile(){
        return cy.get('.canvas-area .text-tool');
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