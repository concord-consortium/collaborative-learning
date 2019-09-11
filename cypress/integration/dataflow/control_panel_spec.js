import dfControlPanels from "../../support/elements/dfControlPanels";
import Header from "../../support/elements/Header";

const controlPanel= new dfControlPanels;
const header = new Header;
before(()=>{
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
        it('verify a hub card has status and channel info when hub is online', ()=>{ //need to make sure EMI-test-sim is running
            var hubName='cc-west-office-hub'
            controlPanel.getHubStatus(hubName).should('contain','status');
            cy.wait(5000)
            controlPanel.getHubStatus(hubName).should('contain', 'online');
            controlPanel.getHubChannelStatus(hubName).should('contain','channels')
            controlPanel.getHubSensorList(hubName).should('have.lengthOf',4)
            controlPanel.getHubSensor(hubName).each(($sensor, index, $list)=>{
                var sensors = ['temperature','humidity','temperature', 'humidity']
                expect($sensor).to.contain(sensors[index]);
            })
        })

    })
})