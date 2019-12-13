import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'relay'

const input_1 = 1, input_0 = 0;

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(3000)
    
    dfcanvas.openBlock('Number')
    dfcanvas.openBlock('Relay')
    dfblock.moveBlock(testBlock,0,250,5)
    dfblock.connectBlocks('number',0,testBlock,0)
    dfcanvas.scrollToTopOfTile();
})

context('Relay block tests',()=>{//Use number block and change the value manually for on/off
    describe('Relay block UI',()=>{
        it('verify UI',()=>{ //block should have 1 dropdowns, one value field, no input node, one output mode
            dfblock.getBlockTitle(testBlock).should('contain','Relay');
            dfblock.getRelayListDropDown().should('be.visible');
            dfblock.getRelayValueTextField().should('be.visible');
            dfblock.getOutputNodesNum(testBlock).should('not.exist');
            dfblock.getInputNode(testBlock).should('be.visible');
        })
        it('verify changing input values turns relay on and off',()=>{ //any number (incl infinity and NaN) sets relay to on. 0 turns it off
            dfblock.getNumberInput(0).type('{backspace}'+input_1+'{enter}');
            dfblock.getRelayValueTextField().should('contain', 'on');
            cy.wait(6000);
            dfblock.getNumberInput(0).type('{backspace}'+input_0+'{enter}');
            dfblock.getRelayValueTextField().should('contain', 'off');
            cy.wait(5000);
            dfblock.getNumberInput(0).type('{backspace}'+input_1+'{enter}');
            dfblock.getRelayValueTextField().should('contain', 'on');
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });