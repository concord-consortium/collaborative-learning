import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

var input1=18, input2=6; //nums typed into math input nodes
var input3=3, input4=2; //nums typed into the 2 number blocks
const testBlock = 'math'

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    
    header.switchWorkspace('Workspace');
    cy.wait(1000);
    dfcanvas.openBlock('Number')
    dfcanvas.openBlock('Number')
    dfcanvas.openBlock('Math');
    dfblock.moveBlock(testBlock,0,300,100)
    dfblock.connectBlocks('number',0,testBlock,0)
    dfblock.connectBlocks('number',1,testBlock,1)
    dfcanvas.scrollToTopOfTile();
})
context('Math block test',()=>{
    describe('Math block UI',()=>{//need 2 number blocks to connect inputs, transform block to connect output
        it('verify UI',()=>{ //block should have 2 input node, one output mode, one dropdown, one value field. Input Nodes can be inputs or textfield
            dfblock.getBlockTitle(testBlock).should('contain','Math');
            dfblock.getMathOperatorDropdown().should('be.visible');
            dfblock.getMathValueTextField().should('be.visible');
            dfblock.getOutputNode(testBlock).should('exist');
            dfblock.getInputNodesNum(testBlock).should('be.visible').and('have.length',2);
        })
    })
    describe('test operators and math equations',()=>{
        before(()=>{
            dfblock.getNumberInput(0).type('{backspace}'+input1+'{enter}');
            dfblock.getNumberInput(1).type('{backspace}'+input2+'{enter}');
            dfcanvas.scrollToTopOfTile();            
            dfcanvas.openBlock('Transform')
            dfblock.connectBlocks(testBlock,0,'transform',0)
        })
        it('verify add',()=>{
            dfblock.getMathValueTextField().should=('contain', input1+' + '+input2+' = '+input1+input2)
            dfblock.getTransformValueTextField().should('contain','|'+(input1+input2)+'| = '+Math.abs((input1+input2)))
        })
        it('verify subtract',()=>{
            dfblock.getMathOperatorDropdown().click();
            dfblock.selectMathOperator('Subtract')
            dfblock.getMathValueTextField().should('contain',input1+' - '+input2+' = '+(input1-input2))
            dfblock.getTransformValueTextField().should('contain','|'+(input1-input2)+'| = '+Math.abs((input1-input2)))
            //subtract negative number
        })
        it('verify multiply',()=>{
            dfblock.getMathOperatorDropdown().click();
            dfblock.selectMathOperator('Multiply')
            dfblock.getMathValueTextField().should('contain',input1+' * '+input2+' = '+(input1*input2))
            dfblock.getTransformValueTextField().should('contain','|'+(input1*input2)+'| = '+Math.abs(input1*input2))
            //multiply negative number
        })
        it('verify divide',()=>{
            dfblock.getMathOperatorDropdown().click();
            dfblock.selectMathOperator('Divide')
            dfblock.getMathValueTextField().should('contain',input1+' / '+input2+' = '+(input1/input2))
            dfblock.getTransformValueTextField().should('contain','|'+(input1/input2)+'| = '+Math.abs(input1/input2))
            //divide by 0 outputs infinity, and 0/0 outputs NaN
        })
    })
    describe('test change input values', ()=>{
        it('verify math equation changes with different input values',()=>{
            dfblock.getNumberInput(0).type('{backspace}{backspace}'+input3+'{enter}');
            dfblock.getMathValueTextField().should('contain',input3+' / '+input2+' = '+(input3/input2))
        })
        it('verify output is correct',()=>{
            dfblock.getTransformValueTextField().should('contain','|'+(input3/input2)+'| = '+Math.abs(input3/input2))
        })
    })    

    describe('Divide by 0',()=>{//divide by 0 outputs infinity, and 0/0 outputs NaN
            var inf='Infinity', input_0=0;
        it('verify x/0',()=>{
            dfblock.getNumberInput(1).type('{backspace}0{enter}')//This defaults to setting text field to 0
            dfblock.getMathValueTextField().should('contain',input3+' / '+input_0+' = '+inf)
            dfblock.getTransformValueTextField().should('contain','|'+(inf)+'| = '+inf)
        })
        it('verify 0/0',()=>{
            dfblock.getNumberInput(0).type('{backspace}0{enter}')//This defaults to setting text field to 0
            dfblock.getMathValueTextField().should('contain',input_0+' / '+input_0+' = '+input_0)
            dfblock.getTransformValueTextField().should('contain','|'+(input_0)+'| = '+input_0)
        })
    })
    describe('test when only one node is connected',()=>{ 
        before(()=>{
            dfblock.deleteBlock('number',1) //lose one of the inputs
            dfblock.getNumberInput(0).type('{backspace}'+input3+'{enter}')
        })
        it('verify block shows correct equation',()=>{ //3 / ___ = 0
            dfblock.getMathValueTextField().should('contain',input3+' / ___ = 0')
        })
        it('verify block outputs correct value',()=>{
            dfblock.getTransformValueTextField().should('contain','|0| = 0')
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });