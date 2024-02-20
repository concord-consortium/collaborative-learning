import ClueCanvas from '../../../support/elements/common/cCanvas';
import PrimaryWorkspace from '../../../support/elements/common/PrimaryWorkspace';
import ResourcePanel from '../../../support/elements/common/ResourcesPanel';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

let clueCanvas = new ClueCanvas;
let xyTile = new XYPlotToolTile;
let tableToolTile = new TableToolTile;
let diagramTile = new DiagramToolTile;
const primaryWorkspace = new PrimaryWorkspace;
const resourcePanel = new ResourcePanel;

const queryParamsMultiDataset = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const queryParamsPlotVariables = `${Cypress.config("qaNoGroupShareUnitStudent5")}`;

const problemDoc = '1.1 Unit Toolbar Configuration';

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
      beforeTest(queryParamsMultiDataset);
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

      //XY Plot tile title restore upon page reload
      cy.wait(2000);
      cy.reload();
      cy.waitForLoad();
      xyTile.getTile().click();
      xyTile.getXYPlotTitle().should('contain', title);

      cy.log("Link Table");
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table 1");

      cy.log("shows edit boxes on axes");
      xyTile.getEditableAxisBox("bottom", "min").should("exist");
      xyTile.getEditableAxisBox("bottom", "max").should("exist");
      xyTile.getEditableAxisBox("left", "min").should("exist");
      xyTile.getEditableAxisBox("left", "max").should("exist");

      cy.log("verify graph dot is displayed");
      xyTile.getGraphDot().should('have.length', 1);

      cy.log("Add Second Row Table Cell");
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(5, '7');
        tableToolTile.getTableCell().eq(5).should('contain', '7');
        tableToolTile.typeInTableCell(6, '6');
        tableToolTile.getTableCell().eq(6).should('contain', '6');
      });

      cy.log("verify graph dot is updated");
      xyTile.getGraphDot().should('have.length', 2);

      // X axis should have scaled to fit 5 and 7.
      xyTile.getEditableAxisBox("bottom", "min").invoke('text').then(parseFloat).should("be.within", -1, 5);
      xyTile.getEditableAxisBox("bottom", "max").invoke('text').then(parseFloat).should("be.within", 7, 12);

      cy.log("add another data point");
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(9, '15');
        tableToolTile.getTableCell(8).should('contain', '15');
        tableToolTile.typeInTableCell(10, '0');
        tableToolTile.getTableCell(9).should('contain', '0');
      });
      // Added data point will be off the right edge of the plot area until we click 'Fit'.
      xyTile.getTile().scrollIntoView();
      xyTile.getGraphDot().should('have.length', 3);
      xyTile.getGraphDot().eq(0).should('be.visible');
      xyTile.getGraphDot().eq(1).should('be.visible');
      xyTile.getGraphDot().eq(2).should('not.be.visible');
      // X axis should not have changed in response to adding a data point.
      xyTile.getEditableAxisBox("bottom", "min").invoke('text').then(parseFloat).should("be.within", -1, 5);
      xyTile.getEditableAxisBox("bottom", "max").invoke('text').then(parseFloat).should("be.within", 7, 12);

      cy.log("fit view");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'fit-all');
      xyTile.getGraphDot().eq(0).should('be.visible');
      xyTile.getGraphDot().eq(1).should('be.visible');
      xyTile.getGraphDot().eq(2).should('be.visible');
      xyTile.getEditableAxisBox("bottom", "min").invoke('text').then(parseFloat).should("be.within", -1, 5);
      xyTile.getEditableAxisBox("bottom", "max").invoke('text').then(parseFloat).should("be.within", 15, 20);

      cy.log("add y2 column to table and show it");
      tableToolTile.getTableTile().click();
      tableToolTile.getAddColumnButton().click();
      tableToolTile.typeInTableCellXY(0, 2, '30');
      tableToolTile.typeInTableCellXY(1, 2, '31');
      tableToolTile.typeInTableCellXY(2, 2, '32');

      xyTile.getTile().click();
      xyTile.getYAttributesLabel().should("contain.text", "y");
      xyTile.selectYAttribute("y2");
      // Should have rescaled to the new Y range, approx 30-32
      xyTile.getEditableAxisBox("left", "min").invoke('text').then(parseFloat).should("be.within", 29, 30);
      xyTile.getEditableAxisBox("left", "max").invoke('text').then(parseFloat).should("be.within", 32, 33);

      // Lock axes button
      clueCanvas.clickToolbarButton("graph", "toggle-lock");
      clueCanvas.toolbarButtonIsSelected("graph", "toggle-lock");

      xyTile.selectYAttribute("y");
      // Should NOT have rescaled this time.
      xyTile.getEditableAxisBox("left", "min").invoke('text').then(parseFloat).should("be.within", 29, 30);
      xyTile.getEditableAxisBox("left", "max").invoke('text').then(parseFloat).should("be.within", 32, 33);

      // Toggle lock back off
      clueCanvas.clickToolbarButton("graph", "toggle-lock");
      clueCanvas.toolbarButtonIsNotSelected("graph", "toggle-lock");

      cy.log("verify edit box for horizontal and vertical axes");
      xyTile.getEditableAxisBox("bottom", "min").click().type('-10{enter}');
      xyTile.getEditableAxisBox("bottom", "min").should('contain', '-10');
      xyTile.getEditableAxisBox("left", "min").click().type('-10.55{enter}');
      xyTile.getEditableAxisBox("left", "min").should('contain', '-10.55');
      xyTile.getEditableAxisBox("left", "max").click().type('50{enter}');
      xyTile.getEditableAxisBox("left", "max").should('contain', '50');

      cy.log("verify nonnumeric inputs are not accepted");
      xyTile.getEditableAxisBox("left", "max").click().type('abc{enter}');
      xyTile.getEditableAxisBox("left", "max").should('contain', '50');

      cy.log("check that values more or less than the other bounding box are not accepted");
      // Excluding the bottom max edit box from these tests because currently, the
      // scrollbar is covering up that element and causing click and type fail on it
      xyTile.getEditableAxisBox("bottom", "min").click().type('60{enter}');
      xyTile.getEditableAxisBox("bottom", "min").should('contain', '-10');
      xyTile.getEditableAxisBox("left", "min").click().type('60{enter}');
      xyTile.getEditableAxisBox("left", "min").should('contain', '-10.55');
      xyTile.getEditableAxisBox("left", "max").click().type('-20{enter}');
      xyTile.getEditableAxisBox("left", "max").should('contain', '50');

      cy.log("restore points to canvas");
      primaryWorkspace.openResourceTab();
      resourcePanel.openPrimaryWorkspaceTab("my-work");
      cy.openDocumentWithTitle('my-work', 'workspaces', problemDoc);
      xyTile.getGraphDot().should('have.length', 3);
      xyTile.getXYPlotTitle().should('contain', title);

       //XY Plot tile restore upon page reload
       cy.wait(2000);
       cy.reload();
       cy.waitForLoad();
       xyTile.getTile().click();
       xyTile.getXYPlotTitle().should('contain', title);
       xyTile.getGraphDot().should('have.length', 3);

      cy.log("Delete XY Plot Tile");
      xyTile.getTile().click();
      clueCanvas.deleteTile('xyplot');
      xyTile.getTile().should('not.exist');
    });

    it("Test duplicating graph", () => {
      beforeTest(queryParamsMultiDataset);
      cy.collapseResourceTabs();

      buildTable([[1, 2], [2, 4], [3, 9], [4, 16]]);

      clueCanvas.addTile("graph");
      xyTile.getTile().should("have.length", 1).should('be.visible');
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table 1");
      xyTile.getGraphDot().should('have.length', 4);

      clueCanvas.getDuplicateTool().click();
      xyTile.getTile().should("have.length", 2).should('be.visible');
      xyTile.getGraphDot().should('have.length', 8);
    });

    it("Test undo redo actions", () => {
      beforeTest(queryParamsMultiDataset);
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
      const defaultTitle = "Graph 1";
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
      beforeTest(queryParamsMultiDataset);
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
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table 1");
      xyTile.getAddSeriesButton().should('be.visible');
      xyTile.getAddSeriesButton().click();
      xyTile.getXAttributesLabel().should('have.length', 1);
      xyTile.getYAttributesLabel().should('have.length', 2);

      cy.log("verify that x attribute cannot be removed and y variables appear in x axis dropdown");
      xyTile.getXAttributesLabel().click();
      xyTile.getPortalButton().contains("Remove").should("not.exist");
      xyTile.getPortalButton().contains("y").should("exist");
      xyTile.getPortalButton().contains("y2").should("exist");

      cy.log("verify that y attribute can be removed when there is more than one and y variables do not appear in the y axis dropdown");
      xyTile.getYAttributesLabel().first().click();
      xyTile.getPortalButton().contains("x").should("exist");
      xyTile.getPortalButton().contains("y2").should("not.exist");
      xyTile.getPortalButton().contains("Remove").should("exist").click();

      cy.log("verify that y attribute cannot be removed when there's only one");
      xyTile.getYAttributesLabel().should("have.length", 1).click();
      xyTile.getPortalButton().contains("Remove").should("not.exist");
    });

    it("Test linking two datasets", () => {
      beforeTest(queryParamsMultiDataset);
      cy.log("Add XY Plot Tile");
      cy.collapseResourceTabs();
      clueCanvas.addTile("graph");
      xyTile.getTile().should('be.visible');

      buildTable([[1, 2], [2, 4], [3, 9]]);
      buildTable([[1, 1], [2, 5], [3, 1], [4, 5]]);

      tableToolTile.getTableTile().should('have.length', 2);

      cy.log("Link First Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
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

    it("Test plotting variables", () => {
      const dialogField = (field) => cy.get(`#evd-${field}`);
      const dialogOkButton = () => cy.get(".modal-button").last();

      beforeTest(queryParamsPlotVariables);

      cy.log("Add Diagram Tile with two variables");
      const name1 = "variable_name", name2 = "second_variable";
      const value1 = "2", value2 = "3";
      clueCanvas.addTile("diagram");
      diagramTile.getDiagramTile().click();
      clueCanvas.clickToolbarButton("diagram", "new-variable");
      diagramTile.getDiagramDialog().should("exist");
      dialogField("name").should("exist").type(name1);
      dialogField("value").should("exist").type(value1);
      dialogOkButton().click();

      clueCanvas.clickToolbarButton("diagram", "new-variable");
      diagramTile.getDiagramDialog().should("exist");
      dialogField("name").should("exist").type(name2);
      dialogField("value").should("exist").type(value2);
      dialogOkButton().click();

      cy.log("Add a Linked Graph");
      clueCanvas.clickToolbarButton("diagram", "variables-link");
      cy.get('select').select("New Graph");
      dialogOkButton().click();
      xyTile.getPlottedVariablesGroup().should("not.exist");
      xyTile.getEditableAxisBox('bottom', 'min').invoke('text').then(parseFloat).should("be.within", -1, 0);
      xyTile.getEditableAxisBox('bottom', 'max').invoke('text').then(parseFloat).should("be.within", 9, 11);

      xyTile.selectXVariable(name1);
      xyTile.getXVariableDropdown().should("contain.text", name1);

      xyTile.selectYVariable(name1);
      xyTile.getYVariableDropdown().should("contain.text", name1);

      xyTile.getPlottedVariablesGroup().should("have.length", 1);
      xyTile.getPlottedVariablesPoint().should("have.length", 1);
      xyTile.getPlottedVariablesLabel().should("have.length", 1).should("have.text", "2, 2");
      // Variable value is 2 so should autoscale to [0, 4]
      xyTile.getEditableAxisBox('bottom', 'min').invoke('text').then(parseFloat).should("be.within", -1, 1);
      xyTile.getEditableAxisBox('bottom', 'max').invoke('text').then(parseFloat).should("be.within", 3, 5);

      cy.log("Change axis labels");
      const xAxisLabel = "x axis";
      xyTile.getXAxisLabel().click();
      xyTile.getXAxisInput().should("be.focused").type(`${xAxisLabel}{enter}`);
      xyTile.getXAxisInput().should("not.exist");
      xyTile.getXAxisLabel().should("contain.text", xAxisLabel);
      const yAxisLabel = "y axis";
      xyTile.getYAxisLabel().click();
      xyTile.getYAxisInput().should("be.focused").type(`${yAxisLabel}{enter}`);
      xyTile.getYAxisInput().should("not.exist");
      xyTile.getYAxisLabel().should("contain.text", yAxisLabel);

      cy.log("Plot multiple traces");
      xyTile.getAddVariablesButton().should("exist").click();

      // Select the x variable for the 2nd trace
      xyTile.selectXVariable(name2, 1);
      xyTile.getXVariableDropdown(1).should("contain.text", name2);

      // Select the y variable for the 2nd trace
      xyTile.selectYVariable(name1, 1);
      xyTile.getYVariableDropdown(1).should("contain.text", name1);

      xyTile.getPlottedVariablesGroup().should("have.length", 2);
      xyTile.getPlottedVariablesPoint().should("have.length", 2);
      xyTile.getPlottedVariablesLabel().should("have.length", 2).eq(1).should("have.text", "3, 2");

      // Fit button should adjust bounds to center points (2,2) and (3,3) - so, 0 to 6 on each axis
      clueCanvas.clickToolbarButton('graph', 'fit-all');
      xyTile.getEditableAxisBox('bottom', 'min').invoke('text').then(parseFloat).should("be.within", -1, 0);
      xyTile.getEditableAxisBox('bottom', 'max').invoke('text').then(parseFloat).should("be.within", 6, 8);

      // Drag point to change value
      diagramTile.getVariableCardField("value").eq(1).should("have.value", "3");
      xyTile.getPlottedVariablesPointHighlight().eq(1).should("exist").should("not.be.visible");
      xyTile.getPlottedVariablesPointHighlight().eq(1).trigger("mouseover");
      xyTile.getPlottedVariablesPointHighlight().eq(1).should("be.visible")
        .trigger('mousedown', { eventConstructor: 'MouseEvent' })
        .trigger('mousemove', { eventConstructor: 'MouseEvent', clientX: 500, clientY: 500 })
        .trigger('mouseup', { eventConstructor: 'MouseEvent', clientX: 500, clientY: 500 });

      // hard to determine exactly what the new value will be, but it should have changed.
      diagramTile.getVariableCardField("value").eq(1).should("not.have.value", "3");

      cy.log("Remove a variable trace");
      xyTile.getRemoveVariablesButton(1).click();
      xyTile.getPlottedVariablesGroup().should("have.length", 1);
      // Only the unlink remove button should remain
      xyTile.getRemoveVariablesButtons().should("have.length", 1);
    });
  });
});
