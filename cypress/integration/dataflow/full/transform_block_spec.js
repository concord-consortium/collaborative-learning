import dfBlock from "../../support/elements/dfBlock";
import dfCanvas from "../../support/elements/dfCanvas";
import LeftNav from "../../support/elements/LeftNav";
import Header from "../../support/elements/Header";
import Canvas from "../../support/elements/Canvas";

const header = new Header;
const leftNav = new LeftNav;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;
const canvas = new Canvas;

const testBlock = 'transform'
context('Transform block test',()=>{
    before(()=>{
        header.switchWorkspace('Workspace');
        cy.wait(1000);
        dfcanvas.openBlock('Number')
        dfcanvas.openBlock('Transform')
        dfcanvas.openBlock('Math')
        dfblock.moveBlock('math',0,250,100)
        dfblock.connectBlocks('number',0,testBlock)
        dfblock.connectBlocks(testBlock,0,'math',0);
        dfblock.connectBlocks('number',0,'math',1);
        dfcanvas.scrollToTopOfTile();
    })
    describe('transform block UI',()=>{//need 1 number block to connect inputs, transform block to connect output
        var num1=2,float=-2.4, negNum1 = num1*-1;

        it('verify UI',()=>{ //block should have 1 input node, one output mode, one dropdown, one value field. Input Nodes can be inputs or textfield
            dfblock.getBlockTitle(testBlock).should('contain','Transform');
            dfblock.getTransformOperatorDropdown().should('be.visible');
            dfblock.getTransformValueTextField().should('be.visible');
            dfblock.getOutputNode(testBlock).should('be.visible');
            dfblock.getInputNode(testBlock).should('be.visible');
        })
        it('verify absolute value',()=>{
            dfblock.getNumberInput().type('{backspace}'+num1+'{enter}');
            dfblock.getTransformValueTextField().should('contain','|'+num1+'| = '+Math.abs(num1))
            dfblock.getNumberInput().type('{backspace}'+negNum1+'{enter}');
            dfblock.getTransformValueTextField().should('contain','|'+negNum1+'| = '+Math.abs(negNum1))
            dfblock.getNumberInput().type('{backspace}{backspace}'+float+'{enter}');
            dfblock.getTransformValueTextField().should('contain','|'+float+'| = '+Math.abs(float))
            dfblock.getMathValueTextField().should('contain', Math.abs(float)+' + '+float+' = '+(Math.abs(float)+float))
        })
        it('verify negation',()=>{
            //subtract negative number
            dfblock.openTransformOperatorDropdown();
            dfblock.selectTransformOperator('negation');
            dfblock.getTransformValueTextField().should('contain','-('+float+') = 2.4')
            dfblock.getMathValueTextField().should('contain', (float*-1)+' + '+float+' = '+((float*-1)+float))
        })
        it('verify not operation',()=>{ //anything x!=0 outputs 0, !0 outputs 1
            dfblock.openTransformOperatorDropdown();
            dfblock.selectTransformOperator('not');
            dfblock.getTransformValueTextField().should('contain','!'+float+' ⇒ 0')
            dfblock.getMathValueTextField().should('contain', '0 + '+float+' = '+(0+float))
            dfblock.getNumberInput().type('{backspace}{backspace}{backspace}{backspace}'+0+'{enter}');
            dfblock.getTransformValueTextField().should('contain','!0 ⇒ 1')
            dfblock.getMathValueTextField().should('contain', '1 + 0 = '+(1+0))
        })
    })
})