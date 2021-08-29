import PrimaryWorkspace from "../common/PrimaryWorkspace";
import Dialog from "../common/Dialog";

let primaryWorkspace = new PrimaryWorkspace;
let dialog = new Dialog;

class CluePrimaryWorkspace{
    getSupportBadge(){
        return cy.get('.support-badge');
    }
    deleteTeacherSupport(tab, section, title){
        primaryWorkspace.getCanvasItemTitle(tab, section).contains(title).parent().siblings('.icon-holder').then(($deleteIcon)=>{
            cy.wrap($deleteIcon).click({force:true});
        });
        cy.wait(3000);
        dialog.getDialogOKButton().click();
    }
}
export default CluePrimaryWorkspace;
