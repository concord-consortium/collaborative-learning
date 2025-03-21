class QuestionToolTile {
    getQuestionTile(workspaceClass) {
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .question-tile`);
    }

    getTileTitle(workspaceClass) {
        return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title-text`);
    }

    getQuestionTileTitle(workspaceClass) {
        return cy.get(`${workspaceClass || ".primary-workspace"} .editable-tile-title`);
    }

    deleteQuestionTile() {
        this.getQuestionTile().last().click();
        cy.get('.tool.delete').click();
        cy.get('.ReactModalPortal .modal-footer .modal-button.default').click();
    }
}

export default QuestionToolTile;
