import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import BarGraphTile from '../../../support/elements/tile/BarGraphTile';
import TableToolTile
 from '../../../support/elements/tile/TableToolTile';
let clueCanvas = new ClueCanvas,
  barGraph = new BarGraphTile,
  tableTile = new TableToolTile;

// eslint-disable-next-line unused-imports/no-unused-vars
const canvas = new Canvas;

function textMatchesList(selector, expected) {
  selector.should('have.length', expected.length);
  selector.each(($el, index) => {
    cy.wrap($el).invoke('text').then(text => cy.wrap(text).should('eq', expected[index]));
  });
}

function beforeTest() {
  const url = "/editor/?appMode=qa&unit=./demo/units/qa/content.json";
  cy.visit(url);
}

context('Bar Graph Tile', function () {

  it('Basic tile operations, ', function () {
    beforeTest();

    clueCanvas.addTile('bargraph');
    barGraph.getTiles().should('have.length', 1);
    barGraph.getTile()
      .should('be.visible')
      .and('have.class', 'bar-graph-tile')
      .and('not.have.class', 'read-only');

    barGraph.getTileTitle().should("be.visible").and('have.text', 'Bar Graph 1');
    barGraph.getYAxisLabel().should('have.text', 'Counts');
    barGraph.getXAxisPulldownButton(0).should('have.text', 'Categories');

    cy.log('Change Y axis label');
    barGraph.getYAxisLabelEditor().should('not.exist');
    barGraph.getYAxisLabelButton().click();
    barGraph.getYAxisLabelEditor().should('be.visible').type(' of something{enter}');
    barGraph.getYAxisLabelEditor().should('not.exist');
    barGraph.getYAxisLabel().should('have.text', 'Counts of something');

    cy.log('Duplicate tile');
    clueCanvas.getDuplicateTool().click();
    barGraph.getTiles().should('have.length', 2);
    barGraph.getTile(0)
      .should('be.visible')
      .and('have.class', 'bar-graph-tile')
      .and('not.have.class', 'read-only');
    barGraph.getTileTitle(0).should("be.visible").and('have.text', 'Bar Graph 1');
    barGraph.getYAxisLabel(0).should('have.text', 'Counts of something');
    barGraph.getXAxisPulldownButton(0).should('have.text', 'Categories');

    barGraph.getTile(1)
      .should('be.visible')
      .and('have.class', 'bar-graph-tile')
      .and('not.have.class', 'read-only');
    barGraph.getTileTitle(1).should("be.visible").and('have.text', 'Bar Graph 2');
    barGraph.getYAxisLabel(1).should('have.text', 'Counts of something');
    barGraph.getXAxisPulldownButton(1).should('have.text', 'Categories');

    cy.log('Delete tile');
    clueCanvas.deleteTile('bargraph');
    clueCanvas.deleteTile('bargraph');
    barGraph.getTiles().should('have.length', 0);
  });

  it('Can link data ', function () {
    beforeTest();

    // Table dataset for testing:
    // 4 instances of X / Y / Z
    // 2 instances of XX / Y / Z
    // 1 instance of X / YY / Z
    clueCanvas.addTile('table');
    tableTile.fillTable(tableTile.getTableTile(), [
      ['X', 'Y', 'Z'],
      ['XX', 'Y', 'Z'],
      ['X', 'YY', 'Z'],
      ['X', 'Y', 'Z'],
      ['XX', 'Y', 'Z'],
      ['X', 'Y', 'Z'],
      ['X', 'Y', 'Z'],
    ]);

    clueCanvas.addTile('bargraph');
    barGraph.getTiles().click();
    barGraph.getYAxisLabel().should('have.text', 'Counts');
    barGraph.getXAxisPulldown().should('have.text', 'Categories');
    barGraph.getYAxisTickLabel().should('not.exist');
    barGraph.getXAxisTickLabel().should('not.exist');
    barGraph.getLegendArea().should('not.exist');
    barGraph.getBar().should('not.exist');

    cy.log('Link bar graph');
    clueCanvas.clickToolbarButton('bargraph', 'link-tile');
    cy.get('select').select('Table Data 1');
    cy.get('.modal-button').contains("Graph It!").click();

    barGraph.getXAxisPulldown().should('have.text', 'x');

    textMatchesList(barGraph.getXAxisTickLabel(), ['X', 'XX']);
    textMatchesList(barGraph.getYAxisTickLabel(), ['0', '1', '2', '3', '4', '5']);
    barGraph.getBar().should('have.length', 2);
    barGraph.getDatasetLabel().should('have.text', 'Table Data 1');
    barGraph.getSortByMenuButton().should('have.text', 'None');
    barGraph.getSecondaryValueName().should('have.length', 1).and('have.text', 'x');

    cy.log('Change Sort By');
    barGraph.getSortByMenuButton().click();
    barGraph.getChakraMenuItem().should('have.length', 3);
    barGraph.getChakraMenuItem().eq(1).should('have.text', 'y').click();
    textMatchesList(barGraph.getXAxisTickLabel(), ['X', 'XX']);
    textMatchesList(barGraph.getYAxisTickLabel(), ['0', '1', '2', '3', '4', '5']);
    barGraph.getBar().should('have.length', 3);
    barGraph.getDatasetLabel().should('have.text', 'Table Data 1');
    barGraph.getSortByMenuButton().should('have.text', 'y');
    textMatchesList(barGraph.getSecondaryValueName(), ['Y', 'YY']);

    cy.log('Change Category');
    barGraph.getXAxisPulldownButton().click();
    barGraph.getChakraMenuItem().should('have.length', 3);
    barGraph.getChakraMenuItem().eq(1).should('have.text', 'y').click();
    barGraph.getXAxisPulldown().should('have.text', 'y');
    textMatchesList(barGraph.getXAxisTickLabel(), ['Y', 'YY']);
    textMatchesList(barGraph.getYAxisTickLabel(), ['0', '2', '4', '6', '8', '10']); // there are 6 Ys in this view so scale expands.
    barGraph.getBar().should('have.length', 2);
    barGraph.getDatasetLabel().should('have.text', 'Table Data 1');
    barGraph.getSortByMenuButton().should('have.text', 'None');
    barGraph.getSecondaryValueName().should('have.length', 1).and('have.text', 'y');

    cy.log('Unlink data');
    barGraph.getDatasetUnlinkButton().click();
    barGraph.getXAxisPulldown().should('have.text', 'Categories');
    barGraph.getYAxisTickLabel().should('not.exist');
    barGraph.getXAxisTickLabel().should('not.exist');
    barGraph.getLegendArea().should('not.exist');
    barGraph.getBar().should('not.exist');
  });

});
