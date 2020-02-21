
import dfRightNav from "../../../support/elements/dataflow/dfRightNav";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfBlock from "../../../support/elements/dataflow/dfBlock";
import Canvas from "../../../support/elements/common/Canvas";
import RightNav from "../../../support/elements/common/RightNav";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import Dialog from "../../../support/elements/common/Dialog";

const dfheader = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;
const canvas = new Canvas;
const rightNav = new RightNav;
const dfrightnav = new dfRightNav;
const dialog = new Dialog;

const program1 = 'Program-1'
const program2 = 'Program-2'
const dataset1 = 'stopped dataset'
const dataset2 = '1 minute dataset'
const dataset3 = '10 minute dataset'

//Add test for when a program is run from a copy of a dataset or a shared dataset/programs
//Add test for going from dataset to program and rerun the program - verify that a new dataset is created and not added on to a previous test
//verify that if data storage or relay are not connected or not present, then run button should be disabled

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.wait(2000)

    // dfcanvas.openBlock('Number')
    // dfcanvas.openBlock('Data Storage')
    // dfblock.getNumberInput().type('9');
    // dfblock.connectBlocks('number',0,'data-storage',0)
    // canvas.editTitle(program1)
})

context('Program Canvas tests',function(){
    describe('Relay tests',()=>{
        const relayTestProgram = "Relay test program"
        const secondRelayTest = 'Second Relay Program'

        it('verify relay that is already in us is not available to another user',()=>{
            dfcanvas.createNewProgram(relayTestProgram)
            dfcanvas.openBlock('Relay');
            dfcanvas.openBlock('Number');
            dfcanvas.moveBlock('relay',0,250,5);
            dfblock.connectBlocks('number',0,'relay',0)
            cy.wait(2000)
            dfblock.selectRelayOperator('codap-server-hub-sim');
            dfcanvas.selectDuration('60')
            dfcanvas.runProgram();
            canvas.copyDocument(secondRelayTest);
            cy.wait(2000)
            dfcanvas.runProgram();
            dialog.getDialogTitle().should('contain','Relay In Use');
            dialog.getDialogOKButton().click();
            rightNav.openSection('my-work','programs')
            rightNav.openCanvasItem('my-work','programs','Programs',relayTestProgram);
            dfcanvas.stopProgram();
        })
        it('verify running relay program is not in My Work>Data',()=>{
            rightNav.openSection('my-work','data');
            rightNav.getCanvasItemTitle('my-work','data','Data').should('not.exist');
            rightNav.getCanvasItemTitle('my-work','data','Data').should('not.exist');
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });