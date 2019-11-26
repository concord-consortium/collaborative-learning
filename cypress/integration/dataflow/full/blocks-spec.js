
import dfBlock from "../../../support/elements/dataflow/dfBlock";
import dfCanvas from "../../../support/elements/dataflow/dfCanvas";
import dfHeader from "../../../support/elements/dataflow/dfHeader";

const header = new dfHeader;
const dfcanvas = new dfCanvas;
const dfblock = new dfBlock;

context('block functionalites and relationships',()=>{
//delete of connection
//connecting to an input that already has a connection
//show plot
//Each block only has one output node
    before(()=>{
            const baseUrl = `${Cypress.config("baseUrl")}`;
            const queryParams = `${Cypress.config("queryParams")}`;

            cy.visit(baseUrl+queryParams);
            cy.wait(2000)
        
            header.switchWorkspace('Workspace');
            cy.wait(1000);
        dfcanvas.openBlock('Number')
        dfcanvas.openBlock('Number')
        dfcanvas.openBlock('Math');
        dfblock.moveBlock('math',0,300,100)
        dfcanvas.scrollToTopOfTile();
    })

    describe('connect blocks',()=>{
        //simple connections of input/output are tested in the specific block tests
        //only one connection to an input is allowed,old connection should go away
        it('connect a block that already has a connection',()=>{ 
            dfblock.connectBlocks('number',0,'math',0);
            dfcanvas.scrollToTopOfTile();
            dfblock.connectionLine().should('exist').and('have.length', 1);
            dfblock.connectBlocks('number',1,'math',0);
            dfblock.connectionLine().should('exist').and('have.length', 1);
        })
        it('connect more than one block from one output',()=>{
            //multiple connections from one output is allowed
            dfblock.connectBlocks('number',0,'math',0);
            dfblock.connectBlocks('number',0,'math',1);
            dfblock.connectionLine().should('exist').and('have.length', 2);
        })
    })
    describe('disconnect blocks',()=>{
        //TODO figure out how to delete a connection line by dragging away from an output node
        // it('verify connection disconnects when user clicks and drags away from an input node',()=>{
        //     dfblock.getOutputNode('number',0)
        //         .trigger('pointerdown')
        //         .trigger('pointermove',50,50,{force:true})
        //         .trigger('pointerup',{force:true})
        //     dfblock.connectionLine().should('not.exist').and('have.length', 1);
        // })
        it('verify connection disconnects when user deletes a connected block',()=>{
            dfblock.selectBlock('number',0);
            dfblock.deleteBlock('number',0)
            dfblock.connectionLine().should('not.exist');
        })
    })
    describe('show plot',()=>{
        it('verify show plot opens the plot view',()=>{
            dfblock.getShowPlotButton('number').click()
            dfblock.getPlotView('number').should('exist');
        })
        it('verifies Hide Plot hids the plot view',()=>{
            dfblock.getShowPlotButton('number').click()
            dfblock.getPlotView('number').should('not.exist');
        })
    })
})
after(function(){
    cy.clearQAData('all');
  });