import Dialog from "../common/Dialog";

const dialog = new Dialog;

class ClueHeader{

    getGroupName(){
        return cy.get('[data-test=group-name]');
    }
    getGroupMembers(){
        return cy.get('[data-test=group-members]');
    }

    leaveGroup(){
        this.getGroupName().click();
        dialog.getDialogTitle().should('contain', 'Leave Group');
        dialog.getDialogOKButton().click();

        // Wait a little bit to make sure this group change makes it to the database
        cy.wait(500);
    }

    cancelLeaveGroup(){
        this.getGroupName().click();
        dialog.getDialogTitle().should('contain', 'Leave Group');
        dialog.getDialogCancelButton().click();
    }
}
export default ClueHeader;
