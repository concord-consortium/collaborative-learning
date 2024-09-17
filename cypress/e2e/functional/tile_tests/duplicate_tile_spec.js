import ClueCanvas from '../../../support/elements/common/cCanvas';
import DrawToolTile from "../../../support/elements/tile/DrawToolTile";
import ImageToolTile from '../../../support/elements/tile/ImageToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';

let clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile,
  imageToolTile = new ImageToolTile,
  tableToolTile = new TableToolTile,
  dataCardToolTile = new DataCardToolTile,
  graphTile = new XYPlotToolTile;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Duplicate Tiles', function () {

  it("Duplicate tool", () => {
    beforeTest();

    const toolButton = toolType => cy.get(`.tool.${toolType}`);
    const duplicateTool = () => toolButton("duplicate");

    cy.log("duplicate tool is enabled properly");
    duplicateTool().should("have.class", "disabled");
    clueCanvas.addTile("image");
    duplicateTool().should("have.class", "enabled");

    cy.log("copies one tile and increments default titles");
    imageToolTile.getImageTile().should("have.length", 1);
    duplicateTool().click();
    imageToolTile.getImageTile().should("have.length", 2);
    imageToolTile.getImageTileTitle().last().should("contain.text", "Image 2");

    cy.log("copies multiple tiles, and only selected tiles");
    const customDrawingTitle = "Custom Drawing";
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTileTitle().type(customDrawingTitle);
    imageToolTile.getImageTile().first().click();
    drawToolTile.getDrawTile().click({ shiftKey: true });
    duplicateTool().click();
    imageToolTile.getImageTile().should("have.length", 3);
    drawToolTile.getDrawTileTitle().last().should("contain.text", customDrawingTitle);

    cy.log("adds tiles immediately after selected tiles");
    imageToolTile.getImageTile().first().click();
    duplicateTool().click();
    imageToolTile.getImageTileTitle().eq(1).should("contain.text", "Image 4");

    cy.log("Duplicate tool with shared models");
    cy.log("duplicates tables");
    clueCanvas.addTile("table");
    tableToolTile.getTableTile().click();
    duplicateTool().click();
    tableToolTile.getTableTile().should("have.length", 2);
    tableToolTile.getTableTitle().last().should("contain.text", "Table Data 2");
    tableToolTile.typeInTableCell(1, "x");
    tableToolTile.getTableCell().eq(1).should("contain.text", "x");
    tableToolTile.getTableCell().eq(5).should("not.contain.text", "x");

    cy.log("duplicates datacards");
    clueCanvas.addTile("datacard");
    dataCardToolTile.getSortSelect().select("Label 1");
    dataCardToolTile.getTile().click();
    duplicateTool().click();
    dataCardToolTile.getTiles().should("have.length", 2);
    dataCardToolTile.getSortSelect(1).should("contain.text", "Label 1");
    dataCardToolTile.getSortSelect(1).select("None");
    dataCardToolTile.getSortSelect(0).should("contain.text", "Label 1");

    cy.log("duplicates graphs");
    clueCanvas.addTile("graph");
    clueCanvas.clickToolbarButton("graph", "link-tile-multiple");
    graphTile.linkDataCard("Card Deck Data 2");
    duplicateTool().click();
    graphTile.getTile().should("have.length", 2);
    graphTile.getXYPlotTitle()
      .should("contain.text", "Graph 1")
      .and("contain.text", "Graph 2");
    graphTile.getLegendTitle()
      .should("contain.text", "Card Deck Data 2")
      .and("contain.text", "Card Deck Data 3");
    graphTile.getXAttributesLabel().should("contain.text", "Label 1");
  });
});
