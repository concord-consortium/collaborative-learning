class QuestionToolTile {
    getQuestionTile(workspaceClass) {
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .question-tile-content`);
    }

    getTileTitle(workspaceClass) {
        return this.getQuestionTile(workspaceClass).find(".title-area");
    }

    getEditableTileTitle(workspaceClass) {
        return this.getQuestionTile(workspaceClass).find(".title-area .editable-tile-title");
    }

    deleteQuestionTile() {
        this.getQuestionTile().last().click();
        cy.get('.tool.delete').click();
        cy.get('.ReactModalPortal .modal-footer .modal-button.default').click();
    }

    getQuestionTileEmbeddedTiles(workspaceClass) {
      return this.getQuestionTile().find('.tool-tile');
    }
}

export default QuestionToolTile;
