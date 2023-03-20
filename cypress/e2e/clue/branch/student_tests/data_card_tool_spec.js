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
      dc.getAttrName().dblclick().type("Attr1 Name{enter}");
      dc.getAttrName().contains("Attr1 Name");
    });
    it("can add a value to an attribute", () => {
      dc.getAttrValue().click().type("Attr1 Value{enter}");
      dc.getTile().click();
      dc.getAttrValueInput().invoke('val').should('eq', 'Attr1 Value');
    });
    it("can toggle between single and sort views", () => {
      dc.getSingleCardView().should('exist');
      dc.getSortSelect().select("Attr1 Name");
      dc.getSortView().should('exist');
      dc.getSortSelect().select("None");
      dc.getSingleCardView().should('exist');
    });
    it("has attribute names that stay in sync on menu and card", () => {
      dc.getAttrName().dblclick().type("Attr1 Renamed{enter}");
      dc.getAttrName().contains("Attr1 Renamed");
      dc.getSortSelect().select("Attr1 Renamed");
      dc.getSortView().should('exist');
      dc.getSortSelect().select("None");
      dc.getSingleCardView().should('exist');
    });
  });
});

