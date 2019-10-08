var ampValue=10,periodValue=1,textFieldValue=10;
import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";

const dfheader = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'generator'
context('Generator block tests',()=>{
    before(()=>{
        dfheader.switchWorkspace('Workspace');
        cy.wait(1000);
        dfcanvas.openBlock('Generator')
        dfcanvas.openBlock('Transform')
        dfblock.moveBlock('transform',0,250,5)
        dfblock.connectBlocks(testBlock,0,'transform',0)
        dfcanvas.scrollToTopOfTile();
    })
    describe('Generator block UI',()=>{
        it('verify UI',()=>{ //block should have dropdown, two text fields, one value field, no input node, one output mode
            dfblock.getBlockTitle(testBlock).should('contain','Generator');
            dfblock.getGeneratorTypeListDropdown().should('be.visible');
            dfblock.getAmplitudeTextField().should('be.visible');
            dfblock.getPeriodTextField().should('be.visible');
            dfblock.getOutputNode(testBlock).should('be.visible');
            dfblock.getInputNodesNum(testBlock).should('not.exist');
        })
        it('verify changing type changes the plot type',()=>{
            dfblock.selectGeneratorType('square');
            dfcanvas.resetPlots();
            dfblock.getGeneratorValueTextField().should('contain','1');
            cy.wait(6000);
            dfblock.getGeneratorValueTextField().should('contain','0')
            cy.wait(5000)

        })
        it('verify changing amplitude changes the values generated',()=>{
            dfblock.enterAmplitude('0{enter}'); //makes the amplitude 10
            dfcanvas.resetPlots();
            dfblock.getGeneratorValueTextField().should('contain','0');
            cy.wait(6000);
            dfblock.getGeneratorValueTextField().should('contain','10')
            cy.wait(5000)
        })
        it('verify changing period changes the values generated',()=>{
            dfblock.enterPeriod('{backspace}'); //makes the period 1
            dfcanvas.resetPlots();
            dfblock.getGeneratorValueTextField().should('contain','0');
            cy.wait(6000);
            dfblock.getGeneratorValueTextField().should('contain','10')
            cy.wait(5000)
        })
        it('verify output node behaves corectly',()=>{
            dfblock.getTransformValueTextField().should('contain','|10| = 10')//TODO when dropdown default value changes

        })
    })
})