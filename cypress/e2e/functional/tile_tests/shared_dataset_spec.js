import ClueCanvas from '../../../support/elements/common/cCanvas';
import DatacardTile from '../../../support/elements/tile/DataCardToolTile';
import TableTile from '../../../support/elements/tile/TableToolTile';
import XYPlotTile from '../../../support/elements/tile/XYPlotToolTile';

let clueCanvas = new ClueCanvas;
let datacardTile = new DatacardTile;
let tableTile = new TableTile;
let xyTile = new XYPlotTile;

const queryParams = `${Cypress.config("qaNoNavPanelUnitStudent5")}`;

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

context('Shared Dataset', function () {
  describe("Shared Dataset Interactions", () => {
    it("Synchronous Highlighting Between Tiles", () => {
      beforeTest(queryParams);

      cy.log("Add Table Tile");
      clueCanvas.addTile('table');
      tableTile.getTableTile().should('be.visible');
      cy.get(".primary-workspace").within((workspace) => {
        tableTile.getAddColumnButton().click();
        tableTile.typeInTableCell(1, '1');
        tableTile.getTableCell().eq(1).should('contain', '1');
        tableTile.typeInTableCell(2, '1');
        tableTile.getTableCell().eq(2).should('contain', '1');
        tableTile.typeInTableCell(3, '2');
        tableTile.getTableCell().eq(3).should('contain', '2');
        tableTile.typeInTableCell(6, '2');
        tableTile.getTableCell().eq(6).should('contain', '2');
        tableTile.typeInTableCell(7, '3');
        tableTile.getTableCell().eq(7).should('contain', '3');
        tableTile.typeInTableCell(8, '5');
        tableTile.getTableCell().eq(8).should('contain', '5');
        tableTile.typeInTableCell(11, '3');
        tableTile.getTableCell().eq(11).should('contain', '3');
        tableTile.typeInTableCell(12, '4');
        tableTile.getTableCell().eq(12).should('contain', '4');
        tableTile.typeInTableCell(13, '8');
        tableTile.getTableCell().eq(13).should('contain', '8');
      });

      cy.log("Add Graph Tile");
      xyTile.getTile().should('not.exist');
      tableTile.createNewLinkedGraph();
      xyTile.getTile().should('exist');

      cy.log("Add Datacard Tile");
      datacardTile.getTiles().should('not.exist');
      tableTile.createNewDatacard();
      datacardTile.getTiles().should('exist');

      cy.log("All Tiles Highlight Cases Selected In Table");
      tableTile.getTableRow().eq(0).should("not.have.class", "highlighted");
      datacardTile.getNavPanel().should("not.have.class", "highlighted");
      datacardTile.getAttrValueCell().eq(0).should("not.have.class", "highlighted");
      xyTile.getHighlightedDot().should("not.exist");
      tableTile.getTableCell().eq(0).click();
      tableTile.getTableRow().eq(0).should("have.class", "highlighted");
      datacardTile.getNavPanel().should("have.class", "highlighted");
      datacardTile.getAttrValueCell().eq(0).should("have.class", "highlighted");
      xyTile.getHighlightedDot().should("have.length", 1);

      cy.log("Visible Datacard Matches Highlighted Case");
      datacardTile.getNavPanel().should("have.text", "Card 1 of 3");
      tableTile.getTableCell().eq(5).click();
      datacardTile.getNavPanel().should("have.text", "Card 2 of 3");

      cy.log("All Tiles Highlight Attributes Selected In Table");
      tableTile.getTableRow().eq(1).should("have.class", "highlighted");
      tableTile.getSelectedColumnHeaders().should("have.length", 0);
      datacardTile.getAttrName().eq(0).should("not.have.class", "highlighted");
      tableTile.getColumnHeader().eq(0).click();
      tableTile.getSelectedColumnHeaders().should("have.length", 1);
      datacardTile.getAttrName().eq(0).should("have.class", "highlighted");
      // Selecting a column should deselect all rows
      tableTile.getTableRow().eq(1).should("not.have.class", "highlighted");
      // TODO: Synchronous attribute highlighting in xy plots

      cy.log("All Tiles Highlight Cases Selected In Datacard");
      tableTile.getTableRow().eq(0).should("not.have.class", "highlighted");
      // TODO: It would be better to check which dot is highlighted, rather than counting how many are highlighted
      xyTile.getHighlightedDot().should("have.length", 3);
      datacardTile.getPreviousCardButton().click();
      datacardTile.getNavPanel().click("left");
      tableTile.getTableRow().eq(0).should("have.class", "highlighted");
      xyTile.getHighlightedDot().should("have.length", 1);
      // Selecting a case should deselect all attributes
      datacardTile.getAttrName().eq(0).should("not.have.class", "highlighted");

      cy.log("All Tiles Highlight Attributes Selected In Datacard");
      tableTile.getSelectedColumnHeaders().should("have.length", 0);
      datacardTile.getAttrName().eq(0).click();
      datacardTile.getAttrName().eq(0).should("have.class", "highlighted");
      tableTile.getSelectedColumnHeaders().should("have.length", 1);
      // Selecting an attribute should deselect all cases
      datacardTile.getNavPanel().should("not.have.class", "highlighted");

      cy.log("All Tiles Highlight Cells Selected In XY Plot");
      xyTile.getTile().click(); // Deselect all cases
      tableTile.getTableCellContent(2).should("not.have.class", "highlighted");
      datacardTile.getAttrValueCell().eq(1).should("not.have.class", "highlighted");
      xyTile.getGraphDot().eq(0).click();
      tableTile.getTableCellContent(2).should("have.class", "highlighted");
      datacardTile.getAttrValueCell().eq(1).should("have.class", "highlighted");

      cy.log("All Tiles Highlight Attributes Selected In XY Plot");
      xyTile.getTile().click(); // Deselect all cases
      tableTile.getSelectedColumnHeaders().should("have.length", 0);
      datacardTile.getAttrName().eq(2).should("not.have.class", "highlighted");
      xyTile.getHighlightedDot().should("not.exist");
      xyTile.selectYAttribute("y2");
      tableTile.getSelectedColumnHeaders().should("have.length", 1);
      datacardTile.getAttrName().eq(2).should("have.class", "highlighted");
      xyTile.getHighlightedDot().should("have.length", 3);

      cy.log("Datacard Sort View Highlights Cases Correctly And Can Change Case Highlight");
      tableTile.getTableRow().eq(1).should("not.have.class", "highlighted");
      datacardTile.getSortSelect().select("x");
      datacardTile.getSortCardHeading().eq(1).should("not.have.class", "highlighted");
      datacardTile.getSortCardHeading().eq(1).click();
      datacardTile.getSortCardHeading().eq(1).should("have.class", "highlighted");
      tableTile.getTableRow().eq(1).should("have.class", "highlighted");

      cy.log("Datacard Sort View Highlights Attributes Correctly And Can Change Attribute Highlight");
      datacardTile.getSortCardAttributes().eq(0).should("not.have.class", "highlighted");
      tableTile.getSelectedColumnHeaders().should("have.length", 0);
      datacardTile.getSortCardAttributes().eq(0).click();
      datacardTile.getSortCardAttributes().eq(0).should("have.class", "highlighted");
      datacardTile.getSortCardHeading().eq(1).should("not.have.class", "highlighted");
      tableTile.getTableRow().eq(1).should("not.have.class", "highlighted");
      tableTile.getSelectedColumnHeaders().should("have.length", 1);

      cy.log("All Tiles Highlight Cells Selected in Table");
      datacardTile.getSortCardValues().eq(1).should("not.have.class", "highlighted");
      tableTile.getTableCellContent(2).should("not.have.class", "highlighted");
      tableTile.getTableCell().eq(2).click();
      datacardTile.getSortCardValues().eq(1).should("have.class", "highlighted");
      tableTile.getTableCellContent(2).should("have.class", "highlighted");
    });
  });
});
