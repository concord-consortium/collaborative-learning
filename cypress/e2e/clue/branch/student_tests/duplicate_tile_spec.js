import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';
import DataCardToolTile from '../../../../support/elements/clue/DataCardToolTile';

let clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile,
  imageToolTile = new ImageToolTile,
  tableToolTile = new TableToolTile,
  dataCardToolTile = new DataCardToolTile;

context('Duplicate Tiles', function () {
  const toolButton = toolType => cy.get(`.tool.${toolType}`);
  const duplicateTool = () => toolButton("duplicate");

  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
  });

  describe("Duplicate tool", () => {
    it("duplicate tool is enabled properly", () => {
      duplicateTool().should("have.class", "disabled");
      clueCanvas.addTile("image");
      duplicateTool().should("have.class", "enabled");
    });

    it("copies one tile and increments default titles", () => {
      imageToolTile.getImageTile().should("have.length", 1);
      duplicateTool().click();
      imageToolTile.getImageTile().should("have.length", 2);
      imageToolTile.getImageTileTitle().last().should("contain.text", "Image 2");
    });

    it("copies multiple tiles, and only selected tiles", () => {
      const customDrawingTitle = "Custom Drawing";
      clueCanvas.addTile("drawing");
      drawToolTile.getDrawTileTitle().type(customDrawingTitle);
      imageToolTile.getImageTile().first().click();
      drawToolTile.getDrawTile().click({ shiftKey: true });
      duplicateTool().click();
      imageToolTile.getImageTile().should("have.length", 3);
      drawToolTile.getDrawTileTitle().last().should("contain.text", customDrawingTitle);
    });

    it("adds tiles immediately after selected tiles", () => {
      imageToolTile.getImageTile().first().click();
      duplicateTool().click();
      imageToolTile.getImageTileTitle().eq(1).should("contain.text", "Image 4");
    });
  });

  describe("Duplicate tool with shared models", () => {
    it("duplicates tables", () => {
      clueCanvas.addTile("table");
      tableToolTile.getTableTile().click();
      duplicateTool().click();
      tableToolTile.getTableTile().should("have.length", 2);
      tableToolTile.getTableTitle().last().should("contain.text", "Table 2");
      tableToolTile.typeInTableCell(1, "x");
      tableToolTile.getTableCell().eq(1).should("contain.text", "x");
      tableToolTile.getTableCell().eq(5).should("not.contain.text", "x");
    });

    it("duplicates datacards", () => {
      clueCanvas.addTile("datacard");
      dataCardToolTile.getSortSelect().select("Label 1");
      dataCardToolTile.getTile().click();
      duplicateTool().click();
      dataCardToolTile.getTiles().should("have.length", 2);
      dataCardToolTile.getSortSelect(1).should("contain.text", "Label 1");
      dataCardToolTile.getSortSelect(1).select("None");
      dataCardToolTile.getSortSelect(0).should("contain.text", "Label 1");
    });
  });
});
