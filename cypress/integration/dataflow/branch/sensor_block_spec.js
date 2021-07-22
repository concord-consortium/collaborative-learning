//verify sensor type is selected has selected class
//verify hubs shown have the sensor selected
//verify selected hub has selected class
//verify .sensor-value shows a non-zero value
//Test sensor dropdown verify hub list updates
//Test select a sensor that has no hubs that have that sensor
//How to test if recording data from a sensor that goes offline
//Sensor block title is correct
//Has only one output node
//Has no input node

import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'sensor'

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.clearQAData('all');
    cy.visit(baseUrl+queryParams);
    cy.wait(3000)

    dfcanvas.openBlock('Sensor')
    dfcanvas.openBlock('Transform')
    dfblock.moveBlock('transform',0,255,5)
    dfblock.connectBlocks(testBlock,0,'transform')
    dfcanvas.scrollToTopOfTile();
})

context('Sensor block tests',()=>{
    describe('Sensor block UI',()=>{
        it('verify UI',()=>{ //block should have 2 dropdowns, one value field, no input node, one output mode
            dfblock.getBlockTitle(testBlock).should('contain','Sensor');
            dfblock.getSensorTypeListDropdown().should('be.visible');
            dfblock.getHubSensorComboListDropdown().should('be.visible');
            dfblock.getSensorValueTextField().should('be.visible');
            dfblock.getOutputNode(testBlock).should('be.visible');
            dfblock.getInputNodesNum(testBlock).should('not.exist');
        })
        it('verify changing sensor type changes the hub list selection',()=>{
            var sensorTypes=['Humidity','Temperature','Particulates'];

            cy.wrap(sensorTypes).each((sensor, index, sensorList)=>{
                dfblock.selectSensorType(sensor);
                cy.wait(10000)
                dfblock.openHubSensorComboListDropdown();
                dfblock.getHubSensorComboOptionList().each(($option, index, $optionList)=>{
                    if(($optionList.length<2)) {
                        expect($option).to.contain(sensor + " Demo Data");
                    }
                    else {
                        expect($option).to.contain(sensor.toLowerCase());
                    }
                })
            })
        })
        it('verify sensor type matches units shown in text field',()=>{
            var sensorTypes=[
                                {type:'Temperature', unit:'°C'},
                                {type:'Humidity', unit:'%'},
                                {type:'CO₂', unit:'PPM'},
                                {type:'O₂',unit:'%'},
                                {type:'Light',unit:'lux'},
                                {type:'Soil Moisture',unit:''},
                                {type:'Particulates',unit:'PM2.5'}
                            ];

            cy.wrap(sensorTypes).each((sensor, index, sensorList)=>{
                dfblock.selectSensorType(sensor.type)
                dfblock.getSensorValueTextField().should('contain',sensor.unit)
            })
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });
