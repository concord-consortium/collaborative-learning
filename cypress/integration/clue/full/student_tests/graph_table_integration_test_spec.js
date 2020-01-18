import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile'
import TableToolTile from '../../../../support/elements/clue/TableToolTile'


const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const tableToolTile = new TableToolTile;

function addTableAndGraph(){
    clueCanvas.addTile('table');
    clueCanvas.addTile('geometry');
}

function connectTableToGraph(){
    const dataTransfer = new DataTransfer;
    tableToolTile.getTableTile().click();
    tableToolTile.getTableTile().parent().parent().should('have.class','selected');

    tableToolTile.getTableTile()
        .trigger('dragstart', {dataTransfer})
    graphToolTile.getGraphTile()
        .trigger('dragover',{dataTransfer})
        .trigger('drop', {dataTransfer})
        .trigger('dragend',{dataTransfer});
}

before(function(){
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=2.1&qaGroup=5";
    cy.clearQAData('all');

    cy.visit(baseUrl+queryParams);
    cy.wait(2000);
    cy.waitForSpinner();
})

context('Disabled graph table integration tests',()=>{
    it('verify problem 2.1 disallows graph table integration',()=>{
        addTableAndGraph()
        connectTableToGraph()
        cy.wait(1000);
        clueCanvas.getLinkIcon().should('not.exist');
    })
})