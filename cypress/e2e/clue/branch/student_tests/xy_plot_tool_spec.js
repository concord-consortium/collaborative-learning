import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import XYPlotToolTile from '../../../../support/elements/clue/XYPlotToolTile';

let clueCanvas = new ClueCanvas;
let xyTile = new XYPlotToolTile;

context('XYPlot Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=brain";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
  });
  describe("XYPlot Tool", () => {
    it("renders XYPlot tool tile", () => {
      cy.collapseResourceTabs();
      clueCanvas.addTile("graph");
      xyTile.getTile().should('be.visible');
    });
  });
});
