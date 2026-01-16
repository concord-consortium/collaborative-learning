import ClueCanvas from '../../../support/elements/common/cCanvas';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';

let clueCanvas = new ClueCanvas;
let numberlineToolTile = new NumberlineToolTile;

function beforeTest() {
  const queryParams = `${Cypress.config("qaNoNavPanelUnitStudent5")}`;
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
    numberlineToolTile.getNumberlineTileTitleText().should("contain", "Number Line");
    numberlineToolTile.getNumberlineTileTitle().click();
    numberlineToolTile.getNumberlineTileTitle().type(newName + '{enter}');
    numberlineToolTile.getNumberlineTileTitleText().should("contain", newName);

    cy.log('will add closed points to a numberline');
    numberlineToolTile.setToolbarPoint(); //click Point in order to add points to numberline
    numberlineToolTile.addPointOnNumberlineTick(-4.0);
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.getPointsOnGraph().should('have.length', 2);

    cy.log('will add open points to a numberline');
    numberlineToolTile.setToolbarOpenPoint();
    numberlineToolTile.addPointOnNumberlineTick(-3.0);
    numberlineToolTile.addPointOnNumberlineTick(1.0);
    numberlineToolTile.getPointsOnGraph().should('have.length', 4);

    cy.log('will change min and max value of numberline and recalculate ticks');
    numberlineToolTile.setMaxValue(10);
    numberlineToolTile.getAllNumberlineTicks().should('contain', 8.5);
    numberlineToolTile.setMinValue(-10);
    numberlineToolTile.getAllNumberlineTicks().should('contain', 6.0);

    cy.log('will always show zero tick when range spans zero');
    // Set asymmetric range where 0 is not evenly spaced
    numberlineToolTile.setMinValue(-3);
    numberlineToolTile.setMaxValue(10);
    // Zero tick should exist even if not in regular spacing
    cy.get(".numberline-tool-container .zero-tick").should("exist");
    // Zero should not have a label since it's not part of regular tick spacing
    numberlineToolTile.getAllNumberlineTicks().should('not.contain', '0');
    
    cy.log('will show zero label when zero is part of regular tick spacing');
    // Set symmetric range where 0 falls on regular spacing
    numberlineToolTile.setMinValue(-5);
    numberlineToolTile.setMaxValue(5);
    cy.get(".numberline-tool-container .zero-tick").should("exist");
    // Now zero should have a label
    numberlineToolTile.getAllNumberlineTicks().should('contain', '0');

    cy.log("will delete a single point");
    numberlineToolTile.setToolbarSelect();
    // Just to select it
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.setToolbarDelete();
    numberlineToolTile.getPointsOnGraph().should('have.length', 3);

    cy.log("will delete all points");
    numberlineToolTile.setToolbarReset();
    numberlineToolTile.hasNoPoints();

    cy.log("will show value label for selected point");
    numberlineToolTile.setToolbarPoint();
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.getPointsOnGraph().should('have.length', 1);
    numberlineToolTile.getValueLabel().should("exist");
    numberlineToolTile.getValueLabelText().should("contain", "2.00");
    numberlineToolTile.getValueLabelLine().should("exist");

    cy.log("will hide value label when point is deselected");
    // Click outside the numberline to deselect
    cy.get(".numberline-tool-container svg").click(10, 10, {force: true});
    numberlineToolTile.getValueLabel().should("not.exist");
    numberlineToolTile.getValueLabelLine().should("not.exist");

    cy.log("will show value label when point is reselected");
    numberlineToolTile.setToolbarSelect();
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.getValueLabel().should("exist");
    numberlineToolTile.getValueLabelText().should("contain", "2.00");

    cy.log("will clear points before reload test");
    numberlineToolTile.setToolbarReset();
    numberlineToolTile.hasNoPoints();

    //Numberline tile restore upon page reload
    cy.wait(2000);
    cy.reload();
    cy.waitForLoad();
    numberlineToolTile.getNumberlineTileTitleText().should("contain", newName);
    numberlineToolTile.getMaxBox().should('contain', 10);
    numberlineToolTile.getMinBox().should('contain', -10);

    cy.log("deletes numberline tile");
    clueCanvas.deleteTile('numberline');
    numberlineToolTile.getNumberlineTile().should("not.exist");
  });
});
