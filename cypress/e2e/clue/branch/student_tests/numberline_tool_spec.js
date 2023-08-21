import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import NumberlineToolTile from '../../../../support/elements/clue/NumberlineToolTile';

let clueCanvas = new ClueCanvas;
let numberlineToolTile = new NumberlineToolTile;

context('Numberline Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    // cy.closeResourceTabs(); //maybe enable this when we have a unit besides example that has a nav tab panel
  });
  describe("Numberline Tile", () => {
    it("renders numberline tile", () => {
      numberlineToolTile.getNumberlineTile().should("not.exist");
      clueCanvas.addTile("numberline");
      numberlineToolTile.getNumberlineTile().should("exist");
      numberlineToolTile.getTileTitle().should("exist");
    });
    it("edit tile title", () => {
      const newName = "Numberline test";
      numberlineToolTile.getTileTitle().should("contain", "Numberline");
      numberlineToolTile.getNumberlineTileTitle().click();
      numberlineToolTile.getNumberlineTileTitle().type(newName + '{enter}');
      numberlineToolTile.getTileTitle().should("contain", newName);
    });
    it('will test adding points to a graph', () => {
      cy.log("add points to numberline");
      numberlineToolTile.addPointToGraph();

    });


    it("deletes numberline tile", ()=>{
      // cy.pause();
      clueCanvas.deleteTile('numberline');
      numberlineToolTile.getNumberlineTile().should("not.exist");
    });

  });
  //places 2 points, checks for two points
  //drags one of the points, checks that its dragged


  //at end of test - delete numberline tile?
});
