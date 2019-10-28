class dfControlPanels {
    getHubListTitle(){
        return cy.get('.dataflow-panel .hub-list-title')
    }
    getHubList(){
        return cy.get('.hubs hub')
    }
    getHubName(){
        return cy.get('.hub-list .hubs .hub .label.name')
    }
    getHubStatus(hubName){
        return cy.get('.hub .name').contains(hubName).siblings('.label').contains('status').then(($statusEl)=>{
            return $statusEl.text();
        });
    }
    getHubChannelStatus(hubName){
        return cy.get('.hub .name').contains(hubName).siblings('.label').contains('channels').then(($statusEl)=>{
            return $statusEl.text();
        });
    }
    getHubSensorList(hubName){
        return cy.get('.hub .name').contains(hubName).siblings('.channel');
    }
    getHubSensor(hubName){
        return cy.get('.hub .name').contains(hubName).siblings('.channel').find('.label')
    }
    getHubSensorReading(hubName, sensor){
        return cy.get('.hub .name').contains(hubName).siblings('.channel').contains(sensor).then(($sensorEl)=>{
            return $sensorEl.text();
        })
    }

}
export default dfControlPanels;