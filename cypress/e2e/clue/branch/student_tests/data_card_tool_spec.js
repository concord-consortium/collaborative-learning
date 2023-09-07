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
    it("has attribute names that stay in sync on sort menu and card", () => {
      dc.getAttrName().dblclick().type("Attr1 Renamed{enter}");
      dc.getAttrName().contains("Attr1 Renamed");
      dc.getSortSelect().select("Attr1 Renamed");
      dc.getSortView().should('exist');
      dc.getSortSelect().select("None");
      dc.getSingleCardView().should('exist');
    });
    it("can add new cards", () =>{
      dc.getSortSelect().select("None");
      dc.getAddCardButton().click();
      dc.getCardNofTotalListing().contains("Card 2 of 2");
      dc.getAddCardButton().click();
      dc.getCardNofTotalListing().contains("Card 3 of 3");
    });
    it("can advance from card to card in both directions", () =>{
      dc.getPreviousCardButton().click();
      dc.getCardNofTotalListing().contains("Card 2 of 3");
      dc.getNextCardButton().click();
      dc.getCardNofTotalListing().contains("Card 3 of 3");
    });
    it("can delete a card", () => {
      dc.getDeleteCardButton().click();
      cy.wait(100);
      dc.getDeleteCardButton().click();
      cy.wait(100);
      dc.getCardNofTotalListing().contains("Card 1 of 1");
    });
    it("can expand and collapse a card in sort view", () =>{
      dc.getSortSelect().select("Attr1 Renamed");
      dc.getSortView().should('exist');
      dc.getSortCardCollapseToggle().click();
      dc.getSortCardData().should('not.exist');
      dc.getSortCardCollapseToggle().click();
      dc.getSortCardData().should('exist');
    });
    it("can add a second attribute", () => {
      dc.getSortSelect().select("None");
      dc.getAddAttributeButton().click();
      dc.getAttrName().eq(1).dblclick().type("animal{enter}");
      // complete this test
    });
    it("can add two different values to two cases of two different attributes", () => {
      // complete this test
    });
    it("shows type-ahead options using existing values for current attribute only", () => {
      // complete this test
    });
  });
});
