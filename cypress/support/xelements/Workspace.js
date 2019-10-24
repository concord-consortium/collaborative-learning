import Header from './Header'
import LeftNav from './LeftNav'
import Canvas from './Canvas'
import RightNav from './RightNav'

class Workspace{

    constructor() {
            this.header = new Header();
            this.leftnav = new LeftNav();
            this.canvas = new Canvas();
            this.rightnav = new RightNav();
    }

    openAndPublishCanvases(){ //This can be used to setup in a lot of test where My Work and Class Work canvases are needed
        this.canvas.publishCanvas();
        // this.leftnav.getLeftNavTabs().each(($tab,index,$tabList)=>{})
        //     .then(($tabList)=>{
        //         var i=0;
        //         for (i=0;i<$tabList.length;i++){
        //             cy.get('#leftNavTab'+i).click({force:true});
        //             this.leftnav.getOpenToWorkspaceButton(i).click({force:true});
        //             this.canvas.publishCanvas();
        //         }
        //         // cy.get('#leftNavTab'+i).click({force:true}); //Close the last tab--leaving clean up to individual tests for now
        //     });
    }

    leaveGroup(){
        this.header.getGroupName().click();
        this.getDialogTitle().should('contain', 'Leave Group');
        this.getDialogOKButton().click();
    }

    cancelLeaveGroup(){
        this.header.getGroupName().click();
        this.getDialogTitle().should('contain', 'Leave Group');
        this.getDialogCancelButton().click();
    }

    getDialogTitle(){
        return cy.get('[data-test=dialog-title]');
    }

    getDialogOKButton(){
        return cy.get('[data-test=dialog-buttons] #okButton');
    }

    getDialogCancelButton(){
        return cy.get('[data-test=dialog-buttons] #cancelButton');
    }
}

export default Workspace;





