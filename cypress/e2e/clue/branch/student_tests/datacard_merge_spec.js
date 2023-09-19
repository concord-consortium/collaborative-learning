import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import Canvas from '../../../../support/elements/common/Canvas';
import DataCardToolTile from '../../../../support/elements/clue/DataCardToolTile';

let clueCanvas = new ClueCanvas;
let dc = new DataCardToolTile;
let canvas = new Canvas;
let studentWorkspace = 'SAS 1.1 Solving a Mystery with Proportional Reasoning';
const dataTransfer = new DataTransfer;


function beforeTest() {
  const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=sas";
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
}

function openMyWork() {
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().then((investigationTitle) => {
    cy.openTopTab('my-work');
    cy.openDocumentThumbnail('my-work', 'workspaces', investigationTitle);
  });
}

context('Merge Data Card Tool Tile', function () {
  it("can merge in data using the merge button", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName(0).dblclick().type("animal{enter}");
    dc.getAttrName(0).contains("animal");
    dc.getAttrValue(0).click().type("cat{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getAttrName(1).dblclick().type("vegetable{enter}");
    dc.getAttrName(1).contains("vegetable");
    dc.getAttrValue(1).click().type("beet{enter}");

    dc.getAttrValue(1).click();
    dc.getMergeDataButton(1).click();
    dc.getMergeDataModalSelect().select("Data Card Collection 1");
    dc.getMergeDataModalAddDataButton().click();
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "vegetable");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("contain", "beet");
    dc.getAttrName(1).eq(1).should("have.text", "animal");
    dc.getNextCardButton(1).click();
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("contain", "cat");
  });
  it("merges two empty Data Card tool tiles", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getTile(0).find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(1).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

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
  });
  it("merges filled-in into empty Data Card tool tile", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName().dblclick().type("Attr1 Name{enter}");
    dc.getAttrName().should("have.text", "Attr1 Name");
    dc.getAttrValue().click().type("Attr1 Value{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getTile(0).find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(1).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");
    dc.getAttrName(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(0).invoke("attr", "value").should("contain", "Attr1 Value");

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });
  it("merges empty into filled-in Data Card tool tile", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getAttrName(1).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(1).contains("Attr1 Name");
    dc.getAttrValue(1).click().type("Attr1 Value{enter}");

    dc.getTile(0).find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(1).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");
    dc.getAttrName(0).should("have.text", "Label 1");
    dc.getAttrValue(0).invoke("attr", "value").should("be.empty");

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("contain", "Attr1 Value");
    dc.getAttrName(1).eq(1).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Label 1");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("be.empty");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });
  it("merges two filled-in Data Card tool tiles", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getAttrName(1).dblclick().type("Attr2 Name{enter}");
    dc.getAttrName(1).contains("Attr2 Name");
    dc.getAttrValue(1).click().type("Attr2 Value{enter}");

    dc.getTile(0).find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(1).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

    dc.getAttrs(0).should("have.length", 1);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 1");
    dc.getAttrName(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(0).invoke("attr", "value").should("contain", "Attr1 Value");

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("contain", "Attr2 Value");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });
  it("merges datacards with same attribute labels", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getAttrName(1).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(1).contains("Attr1 Name");
    dc.getAttrValue(1).click().type("Attr2 Value{enter}");

    dc.getTile(0).find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(1).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

    dc.getAttrs(1).should("have.length", 1);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("contain", "Attr2 Value");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 1);
    dc.getAttrName(1).eq(0).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });
  it("merges while in sort view", () => {
    beforeTest();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    dc.getSortSelect(0).select("Attr1 Name");
    dc.getSortView(0).should('exist');

    clueCanvas.addTile("datacard");
    dc.getTile(1).should("exist");
    dc.getTileTitle(1).should("have.text", "Data Card Collection 2");

    dc.getAttrName(1).dblclick().type("Attr2 Name{enter}");
    dc.getAttrName(1).contains("Attr2 Name");
    dc.getAttrValue(1).click().type("Attr2 Value{enter}");

    dc.getSortSelect(1).select("Attr2 Name");
    dc.getSortView(1).should('exist');

    dc.getTile(0).find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(1).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

    dc.getSortSelect(1).select("None");
    dc.getSingleCardView(1).should('exist');

    dc.getAttrs(1).should("have.length", 2);
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("contain", "Attr2 Value");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("be.empty");
    dc.getNextCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 2 of 2");
    dc.getAttrs(1).should("have.length", 2);
    dc.getAttrName(1).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(1).eq(0).invoke("attr", "value").should("be.empty");
    dc.getAttrName(1).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(1).eq(1).invoke("attr", "value").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(1).click();
    dc.getCardNofTotalListing(1).should("have.text", "Card 1 of 2");
  });

  it("merge Data card tool tile across documents", () => {
    beforeTest();
    openMyWork();
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName(0).dblclick().type("Attr1 Name{enter}");
    dc.getAttrName(0).contains("Attr1 Name");
    dc.getAttrValue(0).click().type("Attr1 Value{enter}");

    cy.log("opens document in main doc on the left");
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspace, "my-work");

    cy.log("creates a Data Card tool tile in new personal workspace");
    clueCanvas.addTile("datacard");
    dc.getTile(0).should("exist");
    dc.getTileTitle(0).should("have.text", "Data Card Collection 1");

    dc.getAttrName(0).dblclick().type("Attr2 Name{enter}");
    dc.getAttrName(0).contains("Attr2 Name");
    dc.getAttrValue(0).click().type("Attr2 Value{enter}");

    cy.log("merge Data card tool tile from left to right");
    dc.getTile(0, "[data-test=\"subtab-workspaces\"] .editable-document-content").find(".data-card-tool")
      .trigger('dragstart', { dataTransfer }).then(() => {
        dc.getTile(0).find(".data-card-tool .data-card-header-row")
          .trigger('drop', { dataTransfer, force: true })
          .trigger('dragend', { dataTransfer, force: true });
      });

    dc.getAttrs(0).should("have.length", 2);
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 2");
    dc.getAttrName(0).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(0).eq(0).invoke("attr", "value").should("contain", "Attr2 Value");
    dc.getAttrName(0).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(0).eq(1).invoke("attr", "value").should("be.empty");
    dc.getNextCardButton(0).click();
    dc.getCardNofTotalListing(0).should("have.text", "Card 2 of 2");
    dc.getAttrs(0).should("have.length", 2);
    dc.getAttrName(0).eq(0).should("have.text", "Attr2 Name");
    dc.getAttrValue(0).eq(0).invoke("attr", "value").should("be.empty");
    dc.getAttrName(0).eq(1).should("have.text", "Attr1 Name");
    dc.getAttrValue(0).eq(1).invoke("attr", "value").should("contain", "Attr1 Value");
    dc.getPreviousCardButton(0).click();
    dc.getCardNofTotalListing(0).should("have.text", "Card 1 of 2");
  });
});
