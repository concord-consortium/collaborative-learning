import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DataCardToolTile from '../../../../support/elements/clue/DataCardToolTile';

let clueCanvas = new ClueCanvas;
let dataCardTile = new DataCardToolTile;

context("DataCard Tool Tile", () => {
  before(() => {
    //const queryParams = `${Cypress.config("queryParams")}`;
    //const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example";
    const queryParams = "?appMode=dev&unit=example" // neither of above work, but this is bad because requires click
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
  });

  describe("DataCard Tool", () => {
    it("renders datacard tool tile", () => {
      clueCanvas.addTile("datacard"); // ¯\_(ツ)_/¯ why does it work?
      dataCardTile.getDataCardToolWrapper().should("exist"); //yes, but with lots of red - I think because params
    })
  })
})
