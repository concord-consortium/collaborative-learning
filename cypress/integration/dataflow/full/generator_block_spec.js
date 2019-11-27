var ampValue=10,periodValue=1,textFieldValue=10;
import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfHeader from "../../../support/elements/dataflow/dfHeader";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

const testBlock = 'generator'

before(()=>{
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;

    cy.visit(baseUrl+queryParams);
    cy.wait(2000)

    header.switchWorkspace('Workspace');
    cy.wait(1000);
    dfcanvas.openBlock('Generator')
    dfcanvas.openBlock('Transform')
    dfblock.moveBlock('transform',0,250,5)
    dfblock.connectBlocks(testBlock,0,'transform',0)
    dfcanvas.scrollToTopOfTile();
})
context('Generator block tests',()=>{
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
            dfblock.selectGeneratorType('Square');
            cy.wait(1000);
            dfblock.getGeneratorValueTextField().text().then((value)=>{
                if(value==1){
                    dfblock.getGeneratorValueTextField().should('contain','1');
                    cy.wait(6000);
                    dfblock.getGeneratorValueTextField().should('contain', "0")
                } else if(value==0){
                    dfblock.getGeneratorValueTextField().should('contain','0');
                    cy.wait(6000);
                    dfblock.getGeneratorValueTextField().should('contain', "1")
                }
            })
            cy.wait(5000)
        })
        it('verify changing amplitude changes the values generated',()=>{
            dfblock.enterAmplitude('{backspace}9{enter}'); //makes the amplitude 9
            cy.wait(1000);
            dfblock.getGeneratorValueTextField().text().then((value)=>{
                if(value==9){
                    dfblock.getGeneratorValueTextField().should('contain','9');
                    cy.wait(6000);
                    dfblock.getGeneratorValueTextField().should('contain', "0")
                } else if(value==0){
                    dfblock.getGeneratorValueTextField().should('contain','0');
                    cy.wait(6000);
                    dfblock.getGeneratorValueTextField().should('contain', "9")
                }
            })
            cy.wait(5000)
        })
        it('verify changing period changes the values generated',()=>{
            dfblock.enterPeriod('{backspace}'); //makes the period 1
            cy.wait(1000)
            dfblock.getGeneratorValueTextField().text().then((value)=>{
                if(value==9){
                    dfblock.getGeneratorValueTextField().should('contain','9');
                    cy.wait(6000);
                    dfblock.getGeneratorValueTextField().should('contain', "9")
                } else if(value==0){
                    dfblock.getGeneratorValueTextField().should('contain','0');
                    cy.wait(6000);
                    dfblock.getGeneratorValueTextField().should('contain', "0")
                }
            })
        })
        it('verify output node behaves corectly',()=>{
            dfblock.getGeneratorValueTextField().text().then((value)=>{
                if(value==9){
                    dfblock.getTransformValueTextField().should('contain','|9| = 9')
                } else if(value==0){
                    dfblock.getTransformValueTextField().should('contain','|0| = 0')
                }
            })
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });