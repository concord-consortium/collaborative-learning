class ClueHeader{

    getGroupName(){
        return cy.get('[data-test=group-name]');
    }
    getGroupMembers(){
        return cy.get('[data-test=group-members]');
    }

    openStudentGroupModal() {
        this.getGroupName().click();
        cy.get('[data-testid=group-management-modal-title]').should('be.visible');
    }

    openTeacherGroupModal() {
        cy.get('.student-groups-button').click();
        cy.get('[data-testid=group-management-modal-title]')
            .should('contain', 'Move Students to Different Groups');
    }

    changeGroup(newGroupId) {
        this.openStudentGroupModal();
        cy.get(`[data-testid=group-card-${newGroupId}]`).click({ force: true });
        cy.get('[data-testid=group-management-modal-save-button]').should('not.be.disabled').click();
        // Wait for the modal to close
        cy.get('[data-testid=group-management-modal-title]').should('not.exist');
        // Wait a little bit to make sure this group change makes it to the database
        cy.wait(500);
    }

    cancelChangeGroup() {
        this.openStudentGroupModal();
        cy.get('[data-testid=group-management-modal-cancel-button]').click();
    }

    teacherMoveStudentToGroup(studentId, groupId) {
        this.openTeacherGroupModal();
        cy.get(`[data-testid=student-card-${studentId}]`).click({ force: true });
        cy.get(`[data-testid=student-card-${studentId}]`).should('have.class', 'selected');
        cy.get(`[data-testid=group-card-${groupId}]`).click({ force: true });
        cy.get('[data-testid=group-management-modal-save-button]').click();
        cy.get('[data-testid=group-management-modal]').should('not.exist');
        // Wait a little bit to make sure this group change makes it to the database
        cy.wait(500);
    }
}
export default ClueHeader;
