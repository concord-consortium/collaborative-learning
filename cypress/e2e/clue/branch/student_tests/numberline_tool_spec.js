import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import NumberlineTile from '../../../../support/elements/clue/NumberlineTile';

let clueCanvas = new ClueCanvas;
let numberlineTile = new NumberlineTile;

//skipping tests for now, will write when theres an axis
context.skip('Numberline Tile', function () {
  beforeEach(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup&unit=example";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Numberline Tile", () => {
    it("renders numberline tile", () => {
      numberlineTile.getNumberlineTile().should("not.exist");
      clueCanvas.addTile("numberline");
      numberlineTile.getNumberlineTile().should("exist");
      numberlineTile.getTileTitle().should("exist");
    });
    it("edit tile title", () => {
      const newName = "Test Simulation";
      clueCanvas.addTile("numberline");
      numberlineTile.getTileTitle().should("contain", "Simulation 1");
      numberlineTile.getNumberlineTileTitle().click();
      numberlineTile.getNumberlineTileTitle().type(newName + '{enter}');
      numberlineTile.getTileTitle().should("contain", newName);
    });
  });
});
