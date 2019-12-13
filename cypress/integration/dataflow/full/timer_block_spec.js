var ampValue=10,periodValue=1,textFieldValue=10;
import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'timer'

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.wait(2000)

    dfcanvas.openBlock('Timer')
    dfcanvas.openBlock('Relay')
    dfblock.moveBlock('relay',0,250,5)
    dfblock.connectBlocks(testBlock,0,'relay',0)
    dfcanvas.scrollToTopOfTile();
})
context('Timer block tests',()=>{
    describe('Timer block UI',()=>{
        it('verify UI',()=>{ //block should have dropdown, two text fields, one value field, no input node, one output mode
            dfblock.getBlockTitle(testBlock).should('contain','Timer');
            dfblock.getTimeTextField('On').should('be.visible');
            dfblock.getTimeTextField('Off').should('be.visible');
            dfblock.getOutputNode(testBlock).should('be.visible');
            dfblock.getInputNodesNum(testBlock).should('not.exist');
            //Need to add dropdown UI test
        })
        it('verify changing period changes the values generated',()=>{
            dfblock.enterTimerDuration('On',2);
            dfblock.enterTimerDuration('Off',2)

            dfblock.getTimerOutputState().text().then((timerState)=>{
                if(timerState=='on'){
                    cy.wait(2000);
                    dfblock.getTimerOutputState().should('contain','off')
                    cy.wait(2000);
                    dfblock.getTimerOutputState().should('contain','on')
                }
                if(timerState=='off'){
                    cy.wait(2000);
                    dfblock.getTimerOutputState().should('contain','on')
                    cy.wait(2000);
                    dfblock.getTimerOutputState().should('contain','off')
                }
            })
        })
        it('verify output node behaves corectly',()=>{
            dfblock.getTimerOutputState().text().then((value)=>{
                if(value=='on'){
                    dfblock.getRelayValueTextField().text().should('contain','on')
                } else if(value=='off'){
                    dfblock.getRelayValueTextField().text().should('contain','off')
                }
            })
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });