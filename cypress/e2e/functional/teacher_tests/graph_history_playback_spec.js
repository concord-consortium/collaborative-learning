import ClueCanvas from "../../../support/elements/common/cCanvas";
import TableToolTile from "../../../support/elements/tile/TableToolTile";
import XYPlotToolTile from "../../../support/elements/tile/XYPlotToolTile";

let clueCanvas = new ClueCanvas;
let tableToolTile = new TableToolTile;
let xyTile = new XYPlotToolTile;

const queryParams = `${Cypress.config("qaUnitTeacher6")}`;
const playbackWS = '[data-test="subtab-workspaces"] .editable-document-content';

function moveSliderTo(percent) {
  cy.get('.rc-slider-horizontal').then($slider => {
    const width = $slider.width();
    cy.wrap($slider).click(width * percent / 100, 0);
  });
}

function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
  clueCanvas.getInvestigationCanvasTitle().text().then((investigationTitle) => {
    cy.openTopTab('my-work');
    cy.openDocumentThumbnail('my-work', 'workspaces', investigationTitle);
  });
}

context('Graph History Playback', () => {
  it('verify linked table data appears in graph during history playback', function () {
    beforeTest(queryParams);

    cy.log('create a table and enter data');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('be.visible');
    cy.get(".primary-workspace").within(() => {
      tableToolTile.typeInTableCell(1, '5');
      tableToolTile.getTableCell().eq(1).should('contain', '5');
      tableToolTile.typeInTableCell(2, '10');
      tableToolTile.getTableCell().eq(2).should('contain', '10');
    });

    cy.log('add a second row of data');
    cy.get(".primary-workspace").within(() => {
      tableToolTile.typeInTableCell(5, '7');
      tableToolTile.getTableCell().eq(5).should('contain', '7');
      tableToolTile.typeInTableCell(6, '6');
      tableToolTile.getTableCell().eq(6).should('contain', '6');
    });

    cy.log('create a graph tile and link the table');
    clueCanvas.addTile('graph');
    xyTile.getTile().should('be.visible');
    clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
    xyTile.linkTable("Table Data 1");
    cy.wait(1000); // extra time for legend resizing

    cy.log('verify dots appear in primary workspace');
    xyTile.getGraphDot().should('have.length', 2);

    cy.log('wait for history to be recorded');
    cy.wait(4000);

    cy.log('open playback controls');
    cy.get('.toolbar .tool.toggleplayback').click();
    cy.get('[data-testid="playback-slider"]').should('be.visible');

    cy.log('verify graph with dots appears in playback document at end of history');
    xyTile.getTile(playbackWS).should('be.visible');
    xyTile.getGraphDot(playbackWS).should('have.length', 2);

    cy.log('scrub to beginning of history - graph tile should not exist');
    moveSliderTo(5);
    cy.get(`${playbackWS} .canvas .document-content .graph-tool-tile`).should('not.exist');

    cy.log('scrub back to end - dots should reappear');
    moveSliderTo(98);
    xyTile.getGraphDot(playbackWS).should('have.length', 2);

    cy.log('verify primary workspace is unaffected during playback');
    xyTile.getGraphDot().should('have.length', 2);
  });

  it('verify graph axis attribute labels restore during history playback', function () {
    beforeTest(queryParams);

    cy.log('create table, enter data, create graph, and link them');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('be.visible');
    cy.get(".primary-workspace").within(() => {
      tableToolTile.typeInTableCell(1, '5');
      tableToolTile.typeInTableCell(2, '10');
    });

    clueCanvas.addTile('graph');
    xyTile.getTile().should('be.visible');
    clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
    xyTile.linkTable("Table Data 1");
    cy.wait(1000);

    cy.log('verify legend attribute labels in primary workspace');
    xyTile.getXAttributesLabel().should('contain.text', 'x');
    xyTile.getYAttributesLabel().should('contain.text', 'y');

    cy.log('wait for history to be recorded');
    cy.wait(4000);

    cy.log('open playback and verify legend attribute labels in playback document');
    cy.get('.toolbar .tool.toggleplayback').click();
    cy.get('[data-testid="playback-slider"]').should('be.visible');
    xyTile.getXAttributesLabel(playbackWS).should('contain.text', 'x');
    xyTile.getYAttributesLabel(playbackWS).should('contain.text', 'y');

    cy.log('scrub to beginning - graph and legend should not exist');
    moveSliderTo(5);
    cy.get(`${playbackWS} .canvas .document-content .graph-tool-tile`).should('not.exist');

    cy.log('scrub back to end - legend attribute labels should be restored');
    moveSliderTo(98);
    xyTile.getXAttributesLabel(playbackWS).should('contain.text', 'x');
    xyTile.getYAttributesLabel(playbackWS).should('contain.text', 'y');
  });
});
