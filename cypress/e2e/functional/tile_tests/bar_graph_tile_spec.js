import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import BarGraphTile from '../../../support/elements/tile/BarGraphTile';

let clueCanvas = new ClueCanvas,
  barGraph = new BarGraphTile;

// eslint-disable-next-line unused-imports/no-unused-vars
const canvas = new Canvas;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context('Bar Graph Tile', function () {

  it('Can create tile', function () {
    beforeTest();

    clueCanvas.addTile('bargraph');
    barGraph.getTiles().should('have.length', 1);
    barGraph.getTile(0)
      .should('be.visible')
      .and('have.class', 'bar-graph-tile')
      .and('not.have.class', 'read-only')
      .and('contain.text', 'This is a bar graph');

    barGraph.getTileTitle(0).should('have.text', 'Bar Graph 1');
  });

});
