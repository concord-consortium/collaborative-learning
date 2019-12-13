import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'data-storage';

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(2000);
        
    dfcanvas.openBlock('Number')
    dfcanvas.openBlock('Data Storage')
    dfblock.moveBlock(testBlock,0,250,5);
    dfcanvas.scrollToTopOfTile();
    dfblock.getNumberInput().type('9');
})
//add test that colors of plots
context('Data Storage block tests',()=>{//Use generator block on square wave for on/off

    describe('Data Storage block UI',()=>{
        it('verify UI',()=>{ //block should have 1 dropdowns, one value field, no input node, one output mode
            dfblock.getBlockTitle(testBlock).should('contain','Data Storage');
            dfblock.getStorageNameTextField().should('be.visible');
            dfblock.getStorageIntervalDropdown().should('be.visible');
            dfblock.getStorageSequenceTextField().should('be.visible');
            dfblock.getOutputNodesNum(testBlock).should('not.exist');
            dfblock.getInputNode(testBlock).should('be.visible');
        })
        it('verify only one Data Storage block can be opened',()=>{
            dfcanvas.getProgramToolbarButtons().contains('Data Storage').parent().should('have.attr', 'disabled')
        })
        it('verify name can be entered',()=>{
            var datasetName = 'test dataset'
            dfblock.getStorageNameTextField().should('have.value','my-dataset');
            dfblock.getStorageNameTextField().type('{selectall}{backspace}'+datasetName);
            dfblock.getStorageNameTextField().should('have.value',datasetName);
        })
        it('verify interval can be chosen',()=>{
            var interval = '5 seconds'
            dfblock.getStorageIntervalDropdown().should('contain','1 second');
            dfblock.selectStorageIntervalTime(interval);
            dfblock.getStorageIntervalDropdown().should('contain', interval);
        })
        it('verify sequence name can be entered',()=>{
            var sequenceName = 'input number'
            dfblock.getStorageSequenceTextField().should('have.value','my-sequence'); //This should now not exist
            dfblock.getStorageSequenceTextField().type('{selectall}{backspace}'+sequenceName);
            dfblock.getStorageSequenceTextField().should('have.value',sequenceName);
        })
        it('verify a new input node is added when a block is connected to an input',()=>{
            dfblock.getInputNodesNum(testBlock).should('have.length',1);
            dfblock.connectBlocks('number',0,testBlock,0)
            dfblock.getInputNodesNum(testBlock).should('have.length',2);
        })
        //add test for when connection is made, the text field exists, and default name should be reasonable
        //add test for disconnection to node. expected is the text field should disappear.
    })
})
after(function(){
    cy.clearQAData('all');
  });