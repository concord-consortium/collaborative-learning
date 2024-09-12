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
    barGraph.getTile()
      .should('be.visible')
      .and('have.class', 'bar-graph-tile')
      .and('not.have.class', 'read-only');

    barGraph.getTileTitle().should("be.visible").and('have.text', 'Bar Graph 1');
    barGraph.getYAxisLabel().should('have.text', 'Counts');
    barGraph.getXAxisPulldownButton(0).should('have.text', 'date');
  });

  it('Can edit Y axis label', function () {
    beforeTest();
    clueCanvas.addTile('bargraph');
    barGraph.getYAxisLabel().should('have.text', 'Counts');
    barGraph.getYAxisLabelEditor().should('not.exist');
    barGraph.getYAxisLabelButton().click();
    barGraph.getYAxisLabelEditor().should('be.visible').type(' of something{enter}');
    barGraph.getYAxisLabelEditor().should('not.exist');
    barGraph.getYAxisLabel().should('have.text', 'Counts of something');
  });

  it('Can change primary category', function () {
    beforeTest();
    clueCanvas.addTile('bargraph');
    barGraph.getXAxisPulldown().should('have.text', 'date');
    barGraph.getXAxisPulldownButton().click();
    barGraph.getXAxisPulldownMenuItem().eq(1).click();
    barGraph.getXAxisPulldown().should('have.text', 'location');
  });

});
