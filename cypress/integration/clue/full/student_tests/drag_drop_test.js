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
    clueCanvas.addTile('text');
    clueCanvas.addTile('table');
}

function dragAndDropTile(movingTile, targetTile, dropZoneDirection) {
    const dataTransfer = new DataTransfer;

    switch (movingTile) {
        case ('table'):
            tableToolTile.getTableTile().eq(0).click()
            tableToolTile.getTableTile().eq(0)
                .trigger('dragstart', { dataTransfer });
            break;
        case ('geometry'):
            graphToolTile.getGraphTile().eq(0).click()
            graphToolTile.getGraphTile().eq(0)
                .trigger('dragstart', { dataTransfer });
            break;
        case ('text'):
            textToolTile.getTextTile().eq(0).click()
            textToolTile.getTextTile().eq(0)
                .trigger('dragstart', { dataTransfer });
            break;
        case ('table'):
            imageToolTile.getImageTile().eq(0).click()
            imageToolTile.getImageTile().eq(0)
                .trigger('dragstart', { dataTransfer });
            break;
    }
    if (targetTile == "text") {
        cy.get('.' + targetTile + '-tool').eq(0).parent().parent().parent().within(() => {
            cy.get('.drop-feedback').eq(0).invoke('attr', 'class', 'drop-feedback show ' + dropZoneDirection)
                .trigger('drop', { dataTransfer, force: true });
        })
    } else {
        cy.get('.' + targetTile + '-tool').eq(0).parent().parent().within(() => {
            cy.get('.drop-feedback').eq(0).invoke('attr', 'class', 'drop-feedback show ' + dropZoneDirection)
                .trigger('drop', { dataTransfer, force: true });
        })
    }
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
            let target = 'bottom' //Determines direction of drop based on target tile [top, left, right, bottom]
            addTableAndGraph();
            dragAndDropTile('table', 'text', 'top');
        })
    });
})

after(function () {
    cy.clearQAData('all');
});