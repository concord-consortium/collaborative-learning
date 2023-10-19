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
      numberlineToolTile.getNumberlineTileTitle().should("exist");
    });
    it("edit tile title", () => {
      const newName = "Numberline test";
      numberlineToolTile.getNumberlineTileTitleText().should("contain", "Numberline");
      console.log("📁 numberline_tool_spec.js ------------------------");


      numberlineToolTile.getNumberlineTileTitle().click();
      numberlineToolTile.getNumberlineTileTitle().type(newName + '{enter}');
      numberlineToolTile.getNumberlineTileTitleText().should("contain", newName);
    });
    it('will test adding points to a numberline', () => {
      cy.log("add points to numberline");
      // numberlineToolTile.addPointOnNumberlineTick(-4.0);
      numberlineToolTile.getNumberlineTick(-4.0).click();

      numberlineToolTile.addPointOnNumberlineTick(2.0);
      cy.pause();
      numberlineToolTile.getPointsOnGraph().should('have.length', 2);
    });

    //TODO: finish drag test : currently it creates a third point 50 pixels
           //to the right of -4 which disapears after hovering
    // it("will drag a point", () => {
    //   numberlineToolTile.cy.get(".defaultPointInnerCircle").first() //attach to -4
    //   .trigger('dragstart')
    //   .trigger('mousemove', 50, 0, { force: true })
    //   .trigger('drop', {force: true});
    //   numberlineToolTile.getPointsOnGraph().should('have.length', 2);
    // });

    it("will delete all points", () =>{
      cy.log("delete all points in the numberline");
      numberlineToolTile.deleteAllPointsOnNumberline();
      numberlineToolTile.getPointsOnGraph().should('have.length', 0);
    });
    it("deletes numberline tile", ()=>{
      clueCanvas.deleteTile('numberline');
      numberlineToolTile.getNumberlineTile().should("not.exist");
    });
  });
});
