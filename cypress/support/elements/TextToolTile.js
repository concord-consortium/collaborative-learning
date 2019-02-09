class TextToolTile {
    getTextTile(){
        return cy.get('.canvas .text-tool.editable');
    }

    enterText(text){
        this.getTextTile().last().click({force:true});
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('contain',text);
    }

    addText(text){
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('contain',text);
    }

    deleteText(text){
        this.getTextTile().last().type(text);
        this.getTextTile().last().should('not.contain', 'delete');
    }
}
export default TextToolTile;