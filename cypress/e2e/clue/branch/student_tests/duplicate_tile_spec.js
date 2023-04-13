import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile';

let clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile,
  imageToolTile = new ImageToolTile;

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
});
