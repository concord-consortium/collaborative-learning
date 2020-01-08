import ClueCanvas from '../../../../support/elements/clue/cCanvas'
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile'
import TableToolTile from '../../../../support/elements/clue/TableToolTile'
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile'
import TextToolTile from '../../../../support/elements/clue/TextToolTile'

const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const tableToolTile = new TableToolTile;
const imageToolTile = new ImageToolTile;
const textToolTile = new TextToolTile;

function addTableAndGraph() {
    clueCanvas.addTile('table');
    clueCanvas.addTile('geometry');
}

before(function () {
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl + queryParams);
    cy.waitForSpinner();
    clueCanvas.getInvestigationCanvasTitle().text().as('title');
})

context('single student functional test', () => {
    describe('test header elements', function () {
        it.only('setup graph and table', function () {
            const dataTransfer = new DataTransfer;
            let dropzoneIndex = 0 //This index doesn't seem to change anything [0-3]
            let target = 'bottom' //Determines direction of drop based on target tile [top, left, right, bottom]

            addTableAndGraph();
            tableToolTile.getTableTile().click()
            tableToolTile.getTableTile()
                .trigger('dragstart', { dataTransfer });
            cy.get('.geometry-tool').parent().parent().within(() => {
                cy.get('.drop-feedback').eq(dropzoneIndex).invoke('attr', 'class', 'drop-feedback show ' + target)
                    .trigger('drop', { dataTransfer, force:true });
            })
        })
    });
})

after(function () {
    cy.clearQAData('all');
});