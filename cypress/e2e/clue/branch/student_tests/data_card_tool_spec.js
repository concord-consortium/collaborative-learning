import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DataCardToolTile from '../../../../support/elements/clue/DataCardToolTile';

let clueCanvas = new ClueCanvas;
let dc = new DataCardToolTile;

context('Data Card Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=moth";
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
  });
  describe("Data Card Tool", () => {
    it("renders Data Card tool tile", () => {
      clueCanvas.addTile("datacard");
      dc.getTile().should("exist");
    });
    it("has a default title", () => {
      dc.getTile().contains("Data Card Collection");
    });
    it("can create a new attribute", () => {
      dc.getNameInputAsInactive().dblclick().type("Hello{enter}");
    });
    it("can toggle between single and sort views", () => {
      cy.get('.single-card-data-area').should('exist');
      dc.getSortSelect().select("Hello");
      cy.get('.sorting-cards-data-area').should('exist');
      dc.getSortSelect().select("None");
      cy.get('.single-card-data-area').should('exist');
    });
  });
});

