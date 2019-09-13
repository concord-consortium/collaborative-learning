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

import dfBlock from "../../support/elements/dfBlock";
import dfCanvas from "../../support/elements/dfCanvas";
import LeftNav from "../../support/elements/LeftNav";
import Header from "../../support/elements/Header";
import Workspace from "../../support/elements/Workspace";
import Canvas from "../../support/elements/Canvas";

const header = new Header;
const leftNav = new LeftNav;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;
const workspace = new Workspace;
const canvas = new Canvas;

const testBlock = 'sensor'
context('Sensor block tests',()=>{
    before(()=>{
        header.switchWorkspace('Workspace');
        cy.wait(1000);
        dfcanvas.openBlock('Sensor')
        dfcanvas.openBlock('Transform')
        dfblock.moveBlock('transform',0,255,5)
        dfblock.connectBlocks(testBlock,0,'transform')
        dfcanvas.scrollToTopOfTile();
    })
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
            var sensorTypes=['humidity','temperature','particulates'];

            cy.wrap(sensorTypes).each((sensor, index, sensorList)=>{
                dfblock.selectSensorType(sensor);
                cy.wait(10000)
                dfblock.openHubSensorComboListDropdown();
                dfblock.getHubSensorComboOptionList().each(($option, index, $optionList)=>{
                    if(($optionList.length<2)) {
                        expect($option).to.contain('None Available');
                    }
                    else {
                        expect($option).to.contain(sensor);
                    } 
                }) 
            })       
        })
        it('verify if there are more than one of the same type of sensor on one hub, plug info is shown',()=>{
            var sensorTypes=['humidity','temeprature'];
            var hub ='cc-west-office-hub'; //use cc-west-hub since it has two temp and two humidity

            dfblock.selectSensorType(sensorTypes[0]);
            cy.wait(10000);
            dfblock.openHubSensorComboListDropdown();
            dfblock.getHubSensorComboOptionList().each(($option, index, $optionList)=>{
                console.log($option.text()+' length: '+ $optionList.length)
                if ($option.text().includes(hub)){ //cc-west-office-hub:humidity(plug 1),cc-west-office-hub:humidity(plug 1)
                    console.log("hub name: "+hub+':'+sensorTypes[0]+'(plug '+(index+1)+')');
                            expect($option).to.contain(hub+':'+sensorTypes[0]+'(plug '+(index+1)+')');
                }
            }) 
        })
        it('verify sensor type matches units shown in text field',()=>{
            var sensorTypes=[
                                {type:'temperature', unit:'°C'},
                                {type:'humidity', unit:'%'},
                                {type:'CO₂', unit:'PPM'},
                                {type:'O₂',unit:'%'},
                                {type:'light',unit:'lux'},
                                {type:'soil moisture',unit:''},
                                {type:'particulates',unit:'PM2.5'}
                            ];

            cy.wrap(sensorTypes).each((sensor, index, sensorList)=>{
                dfblock.selectSensorType(sensor.type)
                dfblock.getSensorValueTextField().should('contain',sensor.unit)
            })       
        })
        it('verify sensor blocks outputs correctly',()=>{
            var sensor = "humidity";
            var hubcce = 'cceast-sim-hub:humidity'
            var hubccw = "cc-west-office-hub:humidity(plug 2)";
            dfblock.selectSensorType(sensor);
            cy.wait(10000)
            dfblock.selectHubSensorCombo(hubccw);
            dfblock.getSensorValueTextField().then(($textField)=>{
                var sensorReading = $textField.text();
                var sensorValue = sensorReading.replace('%','').trim();
                console.log("sensorValue: "+sensorValue);
                dfblock.getTransformValueTextField().should('contain','|'+sensorValue+'| = '+(Math.abs(parseFloat(sensorValue)))).toString()//TODO when dropdown default value changes
            });
        })
    })
})
