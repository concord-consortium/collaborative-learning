import ClueCanvas from '../../../support/elements/common/cCanvas';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';

let clueCanvas = new ClueCanvas;
let numberlineToolTile = new NumberlineToolTile;

function beforeTest() {
  const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example";
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Numberline Tile', function () {
  it("Numberline Tile", () => {
    beforeTest();
    cy.log("renders numberline tile");
    numberlineToolTile.getNumberlineTile().should("not.exist");
    clueCanvas.addTile("numberline");
    numberlineToolTile.getNumberlineTile().should("exist");
    numberlineToolTile.getNumberlineTileTitle().should("exist");

    cy.log("edit tile title");
    const newName = "Numberline test";
    numberlineToolTile.getNumberlineTileTitleText().should("contain", "Numberline");
    numberlineToolTile.getNumberlineTileTitle().click();
    numberlineToolTile.getNumberlineTileTitle().type(newName + '{enter}');
    numberlineToolTile.getNumberlineTileTitleText().should("contain", newName);

    cy.log('will test adding points to a numberline');
    numberlineToolTile.addPointOnNumberlineTick(-4.0);
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.getPointsOnGraph().should('have.length', 2);

    cy.log('will change min and max value of numberline and recalculate ticks');
    numberlineToolTile.setMaxValue(10);
    numberlineToolTile.getAllNumberlineTicks().should('contain', 8.5);
    numberlineToolTile.setMinValue(-10);
    numberlineToolTile.getAllNumberlineTicks().should('contain', 6.0);

    cy.log("will delete all points");
    cy.log("delete all points in the numberline");
    numberlineToolTile.deleteAllPointsOnNumberline();
    numberlineToolTile.getPointsOnGraph().should('have.length', 0);

    cy.log("deletes numberline tile");
    clueCanvas.deleteTile('numberline');
    numberlineToolTile.getNumberlineTile().should("not.exist");
  });
});