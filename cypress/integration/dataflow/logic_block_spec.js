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

var input1=7, input2=6; //nums typed into math input nodes
var input3=3, input4=2; //nums typed into the 2 number blocks
const testBlock = 'logic';

context('Logic block test',()=>{
    before(()=>{
        header.switchWorkspace('Workspace');
        cy.wait(1000);
        dfcanvas.openBlock('Number')
        dfcanvas.openBlock('Number')
        dfcanvas.openBlock('Logic');
        dfcanvas.openBlock('Relay');
        dfblock.moveBlock(testBlock,0,300,100)
        dfblock.connectBlocks('number',0,testBlock,0)
        dfblock.connectBlocks(testBlock,0,'relay',0)
        dfcanvas.scrollToTopOfTile();
    })
    describe('Logic block UI',()=>{//need 1 number block,1 transform to connect inputs, relay block to connect output
        it('verify UI',()=>{ //block should have 2 input node, one output mode, one dropdown, one value field. Input Nodes can be inputs or textfield
            dfblock.getBlockTitle(testBlock).should('contain','Logic');
            dfblock.getLogicOperatorDropdown().should('be.visible');
            dfblock.getLogicValueTextField().should('be.visible');
            dfblock.getOutputNode(testBlock).should('exist');
            dfblock.getInputNodesNum(testBlock).should('be.visible').and('have.length',2);
        })
        it('verify correct equation when only one node is connected',()=>{
            dfblock.getNumberInput(0).type('{backspace}'+input1+'{enter}');
            dfblock.getLogicValueTextField().should('contain', input1+' > ___ ⇒ 0')//0 > ___ ⇒ 0
        })
        it('verify greater than',()=>{ 
            dfblock.connectBlocks('number',1,testBlock,1)
            // dfblock.getLogicValueTextField().should('contain', input1+' > 0 ⇒ '+((input1>0)?1:0))//0 > 0 ⇒ 0
            dfblock.getNumberInput(1).type('{backspace}'+input2+'{enter}');
            dfblock.getLogicValueTextField().should('contain', input1+' > '+input2+' ⇒ '+((input1>input2)?1:0))
            dfblock.getRelayValueTextField().should('contain', ((input1>input2)?'on':'off'))
        })
        it('verify less than',()=>{
            dfblock.getNumberInput(0).type('{backspace}'+input3+'{enter}');
            dfblock.getNumberInput(1).type('{backspace}'+input4+'{enter}');
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('less than')
            dfblock.getLogicValueTextField().should('contain',input3+' < '+input4+' ⇒ '+((input3<input4)?1:0))
            dfblock.getRelayValueTextField().should('contain', ((input3<input4)?'on':'off'))

        })
        it('verify greater than or equal to',()=>{
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('greater than or equal to')
            dfblock.getLogicValueTextField().should('contain',input3+' >= '+input4+' ⇒ '+((input3>=input4)?1:0))
        })
        it('verify less than or equal to',()=>{
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('less than or equal to')
            dfblock.getLogicValueTextField().should('contain',input3+' <= '+input4+' ⇒ '+((input3<=input4)?1:0))
        })
        it('verify equal and not equal',()=>{
            const exp = new RegExp(`^(equal)`, "g")
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator(exp)
            dfblock.getLogicValueTextField().should('contain',input3+' == '+input4+' ⇒ '+((input3==input4)?1:0))
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('not equal')
            dfblock.getLogicValueTextField().should('contain',input3+' != '+input4+' ⇒ '+((input3!=input4)?1:0))
        })
        it('verify and',()=>{
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('and')
            dfblock.getLogicValueTextField().should('contain',input3+' && '+input4+' ⇒ '+((input3&&input4)?1:0))
        })
        it('verify or',()=>{
            const exp = new RegExp(`^(or)`, "g")
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator(exp)
            dfblock.getLogicValueTextField().should('contain',input3+' || '+input4+' ⇒ '+((input3||input4)?1:0))
        })
    })
})