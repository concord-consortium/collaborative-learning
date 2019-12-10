import dfHeader from "../../../support/elements/dataflow/dfHeader";
import RightNav from "../../../support/elements/common/RightNav";
import dfControlPanels from "../../../support/elements/dataflow/dfControlPanels";
import Canvas from "../../../support/elements/common/Canvas";

const header = new dfHeader;
const rightNav = new RightNav;
const controlPanel= new dfControlPanels;
const canvas = new Canvas;

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(3000)
});

context('Workspace view',()=>{
    describe('switch views',()=>{
        it.skip('verify Click on Control Panel button shows the control panel',()=>{
            header.switchWorkspace('Control Panels');
            controlPanel.getHubListTitle().should('contain', 'Registered IoT Hubs');
            canvas.getSingleCanvas().should('not.exist')
            rightNav.getRightNavTabs().should('not.exist')
        })
        it('verify click on Workspace button shows the dataflow workspace',()=>{
            header.switchWorkspace('Workspace');
            canvas.getSingleCanvas().should('be.visible')
            rightNav.getRightNavTabs().should('exist')
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });