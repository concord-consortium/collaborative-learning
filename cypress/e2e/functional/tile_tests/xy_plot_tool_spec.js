import ClueCanvas from '../../../support/elements/common/cCanvas';
import PrimaryWorkspace from '../../../support/elements/common/PrimaryWorkspace';
import ResourcePanel from '../../../support/elements/common/ResourcesPanel';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

let clueCanvas = new ClueCanvas;
let xyTile = new XYPlotToolTile;
let tableToolTile = new TableToolTile;
const primaryWorkspace = new PrimaryWorkspace;
const resourcePanel = new ResourcePanel;

const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example-config-subtabs";

const problemDoc = 'Lesson 1.1 - What is a bionic arm?';

// Construct and fill in a table tile with the given data (a list of lists)
function buildTable(data) {
  // at least two cols, or as many as the longest row in the data array
  const cols = Math.max(2, ...data.map(row => row.length));
  clueCanvas.addTile('table');
  tableToolTile.getTableTile().last().should('be.visible');
  tableToolTile.getTableTile().last().within((tile) => {
    // tile will start with two columns; make more if desired
    for (let i=2; i<cols; i++) {
      tile.getAddColumnButton().click();
    }
    for (let i=0; i<data.length; i++) {
      for (let j=0; j<data[i].length; j++) {
        const cellContent = data[i][j];
        tableToolTile.typeInTableCellXY(i, j, cellContent);
        tableToolTile.getTableCellXY(i, j).should('contain', cellContent);
      }
    }
  });
}

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

context('XYPlot Tool Tile', function () {
  describe("XYPlot Tool", () => {
    it("XYPlot tool tile", () => {
      beforeTest(queryParams);
      cy.log("Add XY Plot Tile");
      cy.collapseResourceTabs();
      clueCanvas.addTile("graph");
      xyTile.getTile().should('be.visible');

      cy.log("Add Table Tile");
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(1, '5');
        tableToolTile.getTableCell().eq(1).should('contain', '5');
        tableToolTile.typeInTableCell(2, '10');
        tableToolTile.getTableCell().eq(2).should('contain', '10');
      });

      cy.log("Rename XY Plot Title");
      const title = "XY Plot test";
      xyTile.getXYPlotTitle().click().type(title + '{enter}');
      xyTile.getXYPlotTitle().should('contain', title);

      cy.log("Link Table");
      clueCanvas.clickToolbarButton('graph', 'link-tile');
      xyTile.linkTable("Table 1");

      cy.log("verify graph dot is displayed");
      xyTile.getGraphDot().should('have.length', 1);

      cy.log("Add Second Row Table Cell");
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(5, '7');
        tableToolTile.getTableCell().eq(5).should('contain', '7');
        tableToolTile.typeInTableCell(6, '15');
        tableToolTile.getTableCell().eq(6).should('contain', '15');
      });

      cy.log("verify graph dot is updated");
      xyTile.getGraphDot().should('have.length', 2);

      cy.log("restore points to canvas");
      primaryWorkspace.openResourceTab();
      resourcePanel.openPrimaryWorkspaceTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', problemDoc);
      xyTile.getGraphDot().should('have.length', 2);
      xyTile.getXYPlotTitle().should('contain', title);

      cy.log("Delete XY Plot Tile");
      xyTile.getTile().click();
      clueCanvas.deleteTile('xyplot');
      xyTile.getTile().should('not.exist');
    });

    it("Test undo redo actions", () => {
      beforeTest(queryParams);
      cy.log("Undo redo  XY Plot Tile creation");
      clueCanvas.addTile('graph');
      xyTile.getTile().should('be.visible');
      clueCanvas.getUndoTool().should("not.have.class", "disabled");
      clueCanvas.getRedoTool().should("have.class", "disabled");
      clueCanvas.getUndoTool().click();
      xyTile.getTile().should("not.exist");
      clueCanvas.getUndoTool().should("have.class", "disabled");
      clueCanvas.getRedoTool().should("not.have.class", "disabled");
      clueCanvas.getRedoTool().click();
      xyTile.getTile().should("exist");
      clueCanvas.getUndoTool().should("not.have.class", "disabled");
      clueCanvas.getRedoTool().should("have.class", "disabled");

      cy.log("Undo redo XY Plot tile content");
      const title = "XY Plot test";
      const defaultTitle = "X-Y Plot 1";
      xyTile.getXYPlotTitle().click().type(title + '{enter}');
      xyTile.getXYPlotTitle().should('contain', title);
      clueCanvas.getUndoTool().click();
      xyTile.getXYPlotTitle().should('contain', defaultTitle);
      clueCanvas.getRedoTool().click();
      xyTile.getXYPlotTitle().should('contain', title);

      cy.log("Undo redo  XY Plot Tile deletion");
      xyTile.getTile().click();
      clueCanvas.deleteTile('xyplot');
      xyTile.getTile().should('not.exist');
      clueCanvas.getUndoTool().click();
      xyTile.getTile().should("exist");
      clueCanvas.getRedoTool().click();
      xyTile.getTile().should('not.exist');
    });

    it("Test adding 2 Y Series", () => {
      beforeTest(queryParams);
      cy.log("Add XY Plot Tile");
      cy.collapseResourceTabs();
      clueCanvas.addTile("graph");
      xyTile.getTile().should('be.visible');

      cy.log("Add Table Tile");
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(1, '5');
        tableToolTile.getTableCell().eq(1).should('contain', '5');
        tableToolTile.typeInTableCell(2, '10');
        tableToolTile.getTableCell().eq(2).should('contain', '10');
        tableToolTile.getAddColumnButton().click();
        tableToolTile.typeInTableCell(3, '8');
        tableToolTile.getTableCell().eq(3).should('contain', '8');
      });

      cy.log("Add Second Row Table Cell");
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(6, '0');
        tableToolTile.getTableCell().eq(6).should('contain', '0');
        tableToolTile.typeInTableCell(7, '4');
        tableToolTile.getTableCell().eq(7).should('contain', '4');
        tableToolTile.typeInTableCell(8, '8');
        tableToolTile.getTableCell().eq(8).should('contain', '8');
      });

      cy.log("Link Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile');
      xyTile.linkTable("Table 1");
      xyTile.getAddSeriesButton().should('be.visible');
      xyTile.getAddSeriesButton().click();
      xyTile.getXAttributesLabel().should('have.length', 1);
      xyTile.getYAttributesLabel().should('have.length', 2);
    });

    it.only("Test linking two datasets", () => {
      beforeTest(queryParams);
      cy.log("Add XY Plot Tile");
      cy.collapseResourceTabs();
      clueCanvas.addTile("graph");
      xyTile.getTile().should('be.visible');

      buildTable([[1, 2], [2, 4], [3, 9]]);
      buildTable([[1, 1], [2, 5], [3, 1], [4, 5]]);

      tableToolTile.getTableTile().should('have.length', 2);

      cy.log("Link First Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile');
      xyTile.linkTable("Table 1");
      xyTile.getXAttributesLabel().should('have.length', 1);
      xyTile.getYAttributesLabel().should('have.length', 1);

      cy.log("Link Second Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table 2");

      xyTile.getXAttributesLabel().should('have.length', 2);
      xyTile.getYAttributesLabel().should('have.length', 2);

    });
  });
});
