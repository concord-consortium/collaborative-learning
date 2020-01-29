import dfControlPanels from "../../../support/elements/dataflow/dfControlPanels";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const controlPanel= new dfControlPanels;
const header = new dfHeader;
before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("teacherQueryParams")}`;

    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);//Change this one to bring up a teacher link
    cy.wait(4000)
    
    header.switchWorkspace('Control Panels');
    cy.wait(3000);
})

context('control panel ui',()=>{
    describe('control panel shows registered hubs', ()=>{
        it('verify Registered Hub List is visible',()=>{
            controlPanel.getHubListTitle().should('contain', 'Registered IoT Hubs');
            cy.wait(3000);
        })
        it('verify a hub card has status and no channel info when hub is offline',()=>{
            var hubName='Virtual_Hub_1'
            controlPanel.getHubStatus(hubName).should('contain','status').and('contain', 'offline');
            controlPanel.getHubChannelStatus(hubName).should('contain','channels').and('contain','no channels available');
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });