import Header from "../../support/elements/Header";
import LeftNav from "../../support/elements/LeftNav";
import RightNav from "../../support/elements/RightNav";
import dfCanvas from "../../support/elements/dfCanvas";
import dfBlock from "../../support/elements/dfBlock";
import dfControlPanels from "../../support/elements/dfControlPanels";


const header = new Header;
const leftNav = new LeftNav;
const rightNav = new RightNav;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;
const controlPanel = new dfControlPanels;

before(()=>{
    header.switchWorkspace('Workspace');
    cy.wait(3000);
    //for now because it's not cleared
})
context('Workspace view',()=>{
    describe('workspace ui',()=>{
        it('verify Dataflow workspace',()=>{
            header.getDataflowWorkspaceSwitch().each(($switch,index,$switchList)=>{
                var switches=['Control Panels','Workspace']
                expect($switch.text()).to.contain(switches[index]);        
            })
        })
    })
    describe('switch views',()=>{
        it('verify Click on Control Panel button shows the control panel',()=>{
            header.switchWorkspace('Control Panels');
            controlPanel.getHubListTitle().should('contain', 'Registered IoT Hubs');
            leftNav.getLeftNavTabs().should('not.exist')
            rightNav.getRightNavTabs().should('not.exist')
        })
        it('verify click on Workspace button shows the dataflow workspace',()=>{
            header.switchWorkspace('Workspace');
            cy.get('.single-workspace').should('be.visible')
            leftNav.getLeftNavTabs().should('be.visible')
            rightNav.getRightNavTabs().should('be.visible')
        })
    })
})

//TODO add all other header, left nav, and right nav elements when finalized