import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

var input1=7, input2=6; //nums typed into math input nodes
var input3=3, input4=2; //nums typed into the 2 number blocks
const testBlock = 'logic';

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(3000)
    
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

context('Logic block test',()=>{
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
            dfblock.selectLogicOperator('Less Than')
            dfblock.getLogicValueTextField().should('contain',input3+' < '+input4+' ⇒ '+((input3<input4)?1:0))
            dfblock.getRelayValueTextField().should('contain', ((input3<input4)?'on':'off'))

        })
        it('verify greater than or equal to',()=>{
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('Greater Than Or Equal To')
            dfblock.getLogicValueTextField().should('contain',input3+' >= '+input4+' ⇒ '+((input3>=input4)?1:0))
        })
        it('verify less than or equal to',()=>{
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('Less Than Or Equal To')
            dfblock.getLogicValueTextField().should('contain',input3+' <= '+input4+' ⇒ '+((input3<=input4)?1:0))
        })
        it('verify equal and not equal',()=>{
            const exp = new RegExp(`^(Equal)`, "g")
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator(exp)
            dfblock.getLogicValueTextField().should('contain',input3+' == '+input4+' ⇒ '+((input3==input4)?1:0))
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('Not Equal')
            dfblock.getLogicValueTextField().should('contain',input3+' != '+input4+' ⇒ '+((input3!=input4)?1:0))
        })
        it('verify and',()=>{
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator('And')
            dfblock.getLogicValueTextField().should('contain',input3+' && '+input4+' ⇒ '+((input3&&input4)?1:0))
        })
        it('verify or',()=>{
            const exp = new RegExp(`^(Or)`, "g")
            dfblock.openLogicOperatorDropdown();
            dfblock.selectLogicOperator(exp)
            dfblock.getLogicValueTextField().should('contain',input3+' || '+input4+' ⇒ '+((input3||input4)?1:0))
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });