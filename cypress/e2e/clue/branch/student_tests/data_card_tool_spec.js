import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DataCardToolTile from '../../../../support/elements/clue/DataCardToolTile';
import XYPlotToolTile from '../../../../support/elements/clue/XYPlotToolTile';

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
          dc.getLinkGraphButton().should('not.be.disabled').click();
          dc.getLinkGraphModalCreateNewButton().click();
          xyplot.getTile().should("exist").contains("Data Card Collection 1");
          xyplot.getXYPlotTitle().should("contain", "Data Card Collection 1");
          xyplot.getXAxisLabel().should("contain", "habitat");

          cy.log("can link and unlink data from a graph");
          // Unlink
          dc.getLinkGraphButton().should('not.be.disabled').click();
          dc.getLinkGraphModalTileMenu().select('Data Card Collection 1');
          dc.getLinkGraphModalLinkButton().should("contain", "Unlink").click();
          xyplot.getXAxisLabel().should("not.contain", "habitat");
          // Re-link
          dc.getLinkGraphButton().should('not.be.disabled').click();
          dc.getLinkGraphModalTileMenu().select('Data Card Collection 1');
          dc.getLinkGraphModalLinkButton().should("contain", "Link").click();
          xyplot.getXAxisLabel().should("contain", "habitat");
        });
      });
