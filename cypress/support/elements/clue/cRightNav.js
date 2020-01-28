import RightNav from "../common/RightNav"
import Dialog from "../common/Dialog";

let rightNav = new RightNav;
let dialog = new Dialog

class ClueRightNav{
    getSupportBadge(){
        return cy.get('.support-badge')
    }
    deleteTeacherSupport(tab, section, title){
        rightNav.getCanvasItemTitle(tab, section).contains(title).parent().siblings('.icon-holder').then(($deleteIcon)=>{
            cy.wrap($deleteIcon).click({force:true})
        })
        cy.wait(3000)
        dialog.getDialogOKButton().click()
    }
}
export default ClueRightNav