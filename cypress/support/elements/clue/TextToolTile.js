class TextToolTile {
    getTextEditor(){
        return cy.get('.canvas-area .text-tool-editor');
    }
    getTextTile(){
        return cy.get('.canvas-area .text-tool');
    }
    enterText(text){
        this.getTextTile().last().click({force:true});
        this.getTextEditor().last().type(text);
        this.getTextEditor().last().should('contain',text);
    }

    deleteText(text){
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('not.contain', 'delete');
    }
}
export default TextToolTile;