import ClueCanvas from '../../../support/elements/common/cCanvas';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';

let clueCanvas = new ClueCanvas;
let dc = new DataCardToolTile;
let xyplot = new XYPlotToolTile;

function beforeTest() {
  const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=moth&mouseSensor";
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

context('Data Card Tool Tile', () => {
  it("Data Card Tool", () => {
    beforeTest();

    cy.log("renders Data Card tool tile");
    clueCanvas.addTile("datacard");
    dc.getTile().should("exist");

    cy.log("has a default title");
    dc.getTile().contains("Data Card Collection");

    cy.log("can create a new attribute");
    dc.getAttrName().dblclick().type("Attr1 Name{enter}");
    dc.getAttrName().contains("Attr1 Name");

    cy.log("can add a value to an attribute");
    dc.getAttrValue().click().type("ocean{enter}");
    dc.getTile().click();
    dc.getAttrValueInput().invoke('val').should('eq', "ocean");

    cy.log("can toggle between single and sort views");
    dc.getSingleCardView().should('exist');
    dc.getSortSelect().select("Attr1 Name");
    dc.getSortView().should('exist');
    dc.getSortSelect().select("None");
    dc.getSingleCardView().should('exist');

    cy.log("has attribute names that stay in sync on sort menu and card");
    dc.getAttrName().dblclick().type("habitat{enter}");
    dc.getAttrName().contains("habitat");
    dc.getSortSelect().select("habitat");
    dc.getSortView().should('exist');
    dc.getSortSelect().select("None");
    dc.getSingleCardView().should('exist');

    cy.log("can add new cards");
    dc.getSortSelect().select("None");
    dc.getAddCardButton().click();
    dc.getCardNofTotalListing().contains("Card 2 of 2");
    dc.getAddCardButton().click();
    dc.getCardNofTotalListing().contains("Card 3 of 3");

    cy.log("can advance from card to card in both directions");
    dc.getPreviousCardButton().click();
    dc.getCardNofTotalListing().contains("Card 2 of 3");
    dc.getNextCardButton().click();
    dc.getCardNofTotalListing().contains("Card 3 of 3");

    cy.log("can delete a card");
    dc.getDeleteCardButton().click();
    cy.wait(100);
    dc.getDeleteCardButton().click();
    cy.wait(100);
    dc.getCardNofTotalListing().contains("Card 1 of 1");

    cy.log("can expand and collapse a card in sort view");
    dc.getSortSelect().select("habitat");
    dc.getSortView().should('exist');
    dc.getSortCardCollapseToggle().click();
    dc.getSortCardData().should('not.exist');
    dc.getSortCardCollapseToggle().click();
    dc.getSortCardData().should('exist');

    cy.log("can add a second attribute and give it a value");
    dc.getSortSelect().select("None");
    dc.getAddAttributeButton().click();
    dc.getAttrName().eq(1).dblclick().type("animal{enter}");
    dc.getAttrName().eq(1).contains("animal");
    dc.getAttrValue().eq(1).click().type("whale{enter}");
    dc.getAttrValueInput().eq(1).invoke('val').should('eq', 'whale');

    cy.log("should resize when attributes are added");
    dc.getAddAttributeButton().click();
    dc.getAddAttributeButton().click();
    dc.getAddAttributeButton().click();
    dc.getAddAttributeButton().click();
    dc.getAttrName().eq(5).contains("Label 4");
    dc.getAttrName().eq(5).should('be.visible');

    cy.log("shows type-ahead options using existing values for current attribute only");
    dc.getAddCardButton().click();
    dc.getAttrValue().eq(0).click().type("desert{enter}");
    dc.getAttrValueInput().eq(0).invoke('val').should('eq', 'desert');
    dc.getAttrValue().eq(1).click().type("camel{enter}");
    dc.getAttrValueInput().eq(1).invoke('val').should('eq', 'camel');
    dc.getAttrValue().eq(0).click().type("{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}");
    dc.getDownshiftOptions().should('have.length', 2);
    dc.getDownshiftOptions().eq(0).contains("desert");
    dc.getDownshiftOptions().eq(1).contains("ocean");
    dc.getAttrValueInput().eq(0).click().type("d");
    dc.getDownshiftOptions().should('have.length', 1);
    dc.getDownshiftOptions().eq(0).contains("desert");

    cy.log("can drag a card into another stack in sort view");
    dc.getSortSelect().select("animal");
    dc.getSortView().should('exist');
    dc.dragCardToStack(1, 0);
    dc.getSortSelect().select("None");
    dc.getCardNofTotalListing().contains("Card 1 of 2");
    dc.getAttrValueInput().eq(0).invoke('val').should('eq', "ocean");
    dc.getAttrValueInput().eq(1).invoke('val').should('eq', "camel");
    dc.getNextCardButton().click();
    dc.getCardNofTotalListing().contains("Card 2 of 2");
    dc.getAttrValueInput().eq(0).invoke('val').should('eq', "d");
    dc.getAttrValueInput().eq(1).invoke('val').should('eq', "camel");

    cy.log("can create a graph from the data");
    dc.getGraphItButton().should('not.be.disabled').click();
    xyplot.getTile().should("exist").contains("Graph 1");
    xyplot.getXYPlotTitle().should("contain", "Graph 1");
    xyplot.getXAxisLabel().should("contain", "habitat");

    cy.log("Copy card functionality");
    // Select a card
    dc.getTile().click();
    // Click the duplicate card button
    dc.getDuplicateCardButton().should('not.be.disabled').click();
    // Number of cards should increase by 1
    // New card has focus/is in view.
    dc.getCardNofTotalListing().contains("Card 3 of 3");
    // New cards can be in the middle of the deck
    dc.getPreviousCardButton().click();
    dc.getDuplicateCardButton().should('not.be.disabled').click();
    dc.getCardNofTotalListing().contains("Card 3 of 4");
    // Data can be changed/is not linked to original card
    dc.getAttrValue().eq(0).dblclick().clear().type("river{enter}");
    dc.getAttrValue().eq(1).dblclick().clear().type("rhinocerotter{enter}");
    dc.getAttrValueInput().eq(0).invoke('val').should('eq', "river");
    dc.getAttrValueInput().eq(1).invoke('val').should('eq', "rhinocerotter");

    cy.log("verify Datacard tile title restore upon page reload");
    const newName = "Data Card Title";
    dc.getTile().find('.title-text-element').first().dblclick();
    dc.getTile().find('.title-text-element').first().type(newName + '{enter}');
    dc.getTile().contains(newName);
    cy.wait(2000);

    cy.log("verify Datacard tile restore upon page reload");
    cy.reload();
    cy.waitForLoad();

    dc.getTile().contains(newName);
    dc.getCardNofTotalListing().contains("Card 3 of 4");
    dc.getAttrName().eq(0).contains("habitat");
    dc.getAttrName().eq(1).contains("animal");
    dc.getAttrValueInput().eq(0).invoke('val').should('eq', "river");
    dc.getAttrValueInput().eq(1).invoke('val').should('eq', "rhinocerotter");
  });
});
