import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";

const dfheader = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'data-storage';
context('Data Storage block tests',()=>{//Use generator block on square wave for on/off
    before(()=>{
        dfheader.switchWorkspace('Workspace');
        cy.wait(1000);
        dfcanvas.openBlock('Generator')
        dfcanvas.openBlock('Data Storage')
        dfblock.moveBlock(testBlock,0,250,5);
        dfcanvas.scrollToTopOfTile();
        dfblock.selectGeneratorType('square');
    })
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
        it('verify interval can be entered',()=>{
            var interval = '5 seconds'
            dfblock.getStorageIntervalDropdown().invoke('text').should('contain','1 second');
            dfblock.selectStorageIntervalTime(interval);
            dfblock.getStorageIntervalDropdown().invoke('text').should('contain','5 second');
        })
        it('verify sequence name can be entered',()=>{
            var sequenceName = 'input generator'
            dfblock.getStorageSequenceTextField().should('have.value','my-sequence');
            dfblock.getStorageSequenceTextField().type('{selectall}{backspace}'+sequenceName);
            dfblock.getStorageSequenceTextField().should('have.value',sequenceName);
        })
        it('verify a new input node is added when a block is connected to an input',()=>{
            dfblock.getInputNodesNum(testBlock).should('have.length',1);
            dfblock.connectBlocks('generator',0,testBlock,0)
            dfblock.getInputNodesNum(testBlock).should('have.length',2);
        })
    })
})