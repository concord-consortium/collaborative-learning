class QuestionToolTile {
    getQuestionTile(workspaceClass) {
        return cy.get(`${workspaceClass || ".primary-workspace"} .canvas-area .question-tile`);
    }

    deleteQuestionTile() {
        this.getQuestionTile().last().click();
        cy.get('.tool.delete').click();
        cy.get('.ReactModalPortal .modal-footer .modal-button.default').click();
    }
}

export default QuestionToolTile;
