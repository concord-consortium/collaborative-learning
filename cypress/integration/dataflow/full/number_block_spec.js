import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const dfheader = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'number'
context('Number block test',()=>{
    before(()=>{
        dfheader.switchWorkspace('Workspace');
        cy.wait(1000);
        dfcanvas.openBlock('Number')
        dfcanvas.scrollToTopOfTile();
    })

    describe('Number block UI',()=>{
        it('verify UI',()=>{ //block should have one text field, no input node, one output mode
            dfblock.getBlockTitle(testBlock).should('contain','Number');
            dfblock.getNumberInput().should('be.visible');
            dfblock.getOutputNode(testBlock).should('be.visible');
            dfblock.getInputNodesNum(testBlock).should('not.exist');
        })
        it('verify manually enter digits into text field',()=>{
            var num1=8;
            dfblock.getNumberInput().type('{backspace}'+num1+'{enter}');
            dfblock.getNumberInput().should('have.value',num1.toString())
        })
        it('verify delete of digits in the text field',()=>{
            dfblock.getNumberInput().click().type('{backspace} {enter}');
            dfblock.getNumberInput().should('have.value','0')
        })
        it('verify enter negative number',()=>{
            var num=-2;
            dfblock.getNumberInput().type('{backspace}'+num+'{enter}')
            dfblock.getNumberInput().should('have.value','-2')
        })
        it('verify float',()=>{
            dfblock.getNumberInput().click().type('.8{enter}');
            dfblock.getNumberInput().should('have.value','-2.8')
        })
        it('verify add non-digit value does not add non-digit value',()=>{
            dfblock.getNumberInput().type('g{enter}');
            dfblock.getNumberInput().should('have.value','-2.8')
        })
        it('verify changing value in text field changes output node value',()=>{
            //use transform to verify output value?
            dfcanvas.openBlock('Transform');
            dfblock.connectBlocks(testBlock,0,'transform')
            dfblock.getTransformValueTextField().should('contain','|-2.8| = 2.8')//TODO when dropdown default value changes
            dfblock.getNumberInput().click().type('{backspace}{backspace}{backspace}{backspace}1{enter}')
            dfblock.getTransformValueTextField().should('contain','|1| = 1')
        })
    })
})