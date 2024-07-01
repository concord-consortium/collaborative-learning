import ClueCanvas from '../../../support/elements/common/cCanvas';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';

let clueCanvas = new ClueCanvas;
let dc = new DataCardToolTile;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Merge Data Card Tool Tile', function () {
  it("Merge Data Card Tool Tile", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    dc.getAttrName(0).dblclick().type("animal{enter}");
    dc.getAttrName(0).contains("animal");
    dc.getAttrValue(0).click().type("cat{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getAttrName(1).dblclick().type("vegetable{enter}");
    dc.getAttrName(1).contains("vegetable");
    dc.getAttrValue(1).click().type("beet{enter}");

    dc.getAttrValue(1).click();
    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "vegetable");
    dc.getAttrValue(1).eq(0).invoke("val").should("contain", "beet");
    dc.getAttrName(1).eq(1).should("have.text", "animal");
    dc.getNextCardButton(1).click();
    dc.getAttrValue(1).eq(1).invoke("val").should("contain", "cat");

    cy.log("merges two empty Data Card tool tiles");
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");

    dc.getAttrs(1).should("have.length", 1);
    dc.getAttrName(1).should("have.text", "Label 1");
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 1);
    dc.getAttrName(1).should("have.text", "Label 1");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");

    cy.log("merges filled-in into empty Data Card tool tile");
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    dc.getAttrName().dblclick().type("Attr1 Name{enter}");
    dc.getAttrName().should("have.text", "Attr1 Name");
    dc.getAttrValue().click().type("Attr1 Value{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");
    dc.getAttrName(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(0).invoke("val").should("contain", "Attr1 Value");

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(0).invoke("val").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("val").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(0).invoke("val").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("val").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");

    cy.log("merges empty into filled-in Data Card tool tile");
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getAttrName(1).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(1).contains("Attr1 Name");
    dc.getAttrValue(1).click().type("Attr1 Value{enter}");

    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");
    dc.getAttrName(0).should("have.text", "Label 1");
    dc.getAttrValue(0).invoke("val").should("be.empty");

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("contain", "Attr1 Value");
    dc.getAttrName(1).eq(1).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(1).invoke("val").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(1).invoke("val").should("be.empty");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");

    cy.log("merges two filled-in Data Card tool tiles");
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getAttrName(1).dblclick().type("Attr2 Name{enter}");
    dc.getAttrName(1).contains("Attr2 Name");
    dc.getAttrValue(1).click().type("Attr2 Value{enter}");

    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");
    dc.getAttrName(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(0).invoke("val").should("contain", "Attr1 Value");

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("contain", "Attr2 Value");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("val").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("val").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");

    cy.log("merges datacards with same attribute labels");
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getAttrName(1).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(1).contains("Attr1 Name");
    dc.getAttrValue(1).click().type("Attr2 Value{enter}");

    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getAttrs(1).should("have.length", 1);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("contain", "Attr2 Value");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 1);
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });
  it("merges while in sort view", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Card Deck Data 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    dc.getSortSelect(0).select("Attr1 Name");
    dc.getSortView(0).should('exist');

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Card Deck Data 2");

    dc.getAttrName(1).dblclick().type("Attr2 Name{enter}");
    dc.getAttrName(1).contains("Attr2 Name");
    dc.getAttrValue(1).click().type("Attr2 Value{enter}");

    dc.getSortSelect(1).select("Attr2 Name");
    dc.getSortView(1).should('exist');

    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Card Deck Data 1");
    dc.getMergeDataModalAddDataButton().click();

    dc.getSortSelect(1).select("None");
    dc.getSingleCardView(1).should('exist');

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("contain", "Attr2 Value");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("val").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("val").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("val").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });
});
