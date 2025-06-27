import ClueCanvas from '../../../support/elements/common/cCanvas';
import PrimaryWorkspace from '../../../support/elements/common/PrimaryWorkspace';
import ResourcePanel from '../../../support/elements/common/ResourcesPanel';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import { clueDataColors, hexToRgb } from '../../../support/utils/data-display';

let clueCanvas = new ClueCanvas;
let xyTile = new XYPlotToolTile;
let dataCard = new DataCardToolTile;
let tableToolTile = new TableToolTile;
let diagramTile = new DiagramToolTile;
const primaryWorkspace = new PrimaryWorkspace;
const resourcePanel = new ResourcePanel;

const queryParamsMultiDataset = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const queryParamsPlotVariables = `${Cypress.config("qaNoGroupShareUnitStudent5")}`;

const problemDoc = '1.1 Unit Toolbar Configuration';

// Parse `transform` attributes (used for point positioning)
function xAttributeOfTransform(matcher) {
  return attributeOfTransform(matcher, 1);
}
function yAttributeOfTransform(matcher) {
  return attributeOfTransform(matcher, 2);
}
function attributeOfTransform(matcher, n) {
  return matcher
    .invoke('attr', 'transform')
    .then(transform => {
      return transform.match(/translate\((-?[0-9.]+), *(-?[0-9.]+)\)/)[n];
    })
    .then(parseFloat);
}


function beforeTest(params) {
  cy.visit(params);
  cy.waitForLoad();
}

context('XYPlot Tool Tile', function () {
  describe("XYPlot Tool", () => {
    // TODO: Re-enable this test once the underlying issue is resolved
    // Skipped due to failing Cypress tests as discussed in Slack
    it.skip("XYPlot tool tile", () => {
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
      xyTile.linkTable("Table Data 1");
      cy.wait(1000); // Needs a little extra time, probably due to legend resizing.
      // Otherwise the upcoming typeInTableCell fails.

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

      cy.log("verify graph dot is added");
      xyTile.getGraphDot().should('have.length', 2);

      // X axis should have scaled to fit 5 and 7.
      xyTile.getEditableAxisBox("bottom", "min").invoke('text').then(parseFloat).should("be.within", -1, 5);
      xyTile.getEditableAxisBox("bottom", "max").invoke('text').then(parseFloat).should("be.within", 7, 12);

      cy.log("add another data point with axes locked");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton("graph", "toggle-lock");
      clueCanvas.toolbarButtonIsSelected("graph", "toggle-lock");
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(9, '15');
        tableToolTile.getTableCell(8).should('contain', '15');
        tableToolTile.typeInTableCell(10, '0');
        tableToolTile.getTableCell(9).should('contain', '0');
      });
      // Added data point will be off the right edge of the plot area until we click 'Fit'.
      xyTile.getTile().scrollIntoView();
      xyTile.getGraphDot().should('have.length', 3);
      xyTile.getGraphDot().eq(0).children('circle.inner-circle').should('be.visible');
      xyTile.getGraphDot().eq(1).children('circle.inner-circle').should('be.visible');
      xyTile.getGraphDot().eq(2).children('circle.inner-circle').should('not.be.visible');
            // X axis should not have changed in response to adding a data point.
      xyTile.getEditableAxisBox("bottom", "min").invoke('text').then(parseFloat).should("be.within", -1, 5);
      xyTile.getEditableAxisBox("bottom", "max").invoke('text').then(parseFloat).should("be.within", 7, 12);

      cy.log("fit view");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'fit-all');
      xyTile.getGraphDot().eq(0).children('circle.inner-circle').should('be.visible');
      xyTile.getGraphDot().eq(1).children('circle.inner-circle').should('be.visible');
      xyTile.getGraphDot().eq(2).children('circle.inner-circle').should('be.visible');
      xyTile.getEditableAxisBox("bottom", "min").invoke('text').then(parseFloat).should("be.within", -1, 5);
      xyTile.getEditableAxisBox("bottom", "max").invoke('text').then(parseFloat).should("be.within", 15, 20);

      // Turn Lock axes off
      clueCanvas.clickToolbarButton("graph", "toggle-lock");
      clueCanvas.toolbarButtonIsNotSelected("graph", "toggle-lock");

      cy.log("add y2 column to table and show it");
      tableToolTile.getTableTile().click();
      tableToolTile.getAddColumnButton().click();
      tableToolTile.typeInTableCellXY(0, 2, '30');
      tableToolTile.typeInTableCellXY(1, 2, '31');
      tableToolTile.typeInTableCellXY(2, 2, '32');

      xyTile.getTile().click();
      xyTile.getYAttributesLabel().should("contain.text", "y");
      xyTile.selectYAttribute("y2");
      cy.wait(1000); // animation
      // Should have rescaled to the new Y range, approx 30-32
      xyTile.getEditableAxisBox("left", "min").invoke('text').then(parseFloat).should("be.within", 29, 30);
      xyTile.getEditableAxisBox("left", "max").invoke('text').then(parseFloat).should("be.within", 32, 33);

      // Lock axes button
      clueCanvas.clickToolbarButton("graph", "toggle-lock");
      clueCanvas.toolbarButtonIsSelected("graph", "toggle-lock");

      xyTile.selectYAttribute("y");
      cy.wait(1000); // animation
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

      // TODO: More thorough color checks.
      cy.log("check colors of dots");
      xyTile.getGraphDot().eq(0).find('.inner-circle').should('have.attr', 'style').and('contain', hexToRgb(clueDataColors[0]));
      xyTile.selectYAttribute("y2");
      xyTile.getGraphDot().eq(0).find('.inner-circle').should('have.attr', 'style').and('contain', hexToRgb(clueDataColors[1]));

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

    it("Graph can be linked to table with expression", () => {
      beforeTest(queryParamsMultiDataset);
      cy.collapseResourceTabs();
      clueCanvas.addTile("graph");
      xyTile.getTile().should('be.visible');

      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
      clueCanvas.clickToolbarButton('table', 'set-expression');
      cy.get('#expression-input').click().type('x*x{enter}');
      tableToolTile.typeInTableCellXY(0, 0, '5');
      tableToolTile.getTableCellXY(0, 0).should('contain', '5');
      tableToolTile.getTableCellXY(0, 1).should('contain', '25');
      tableToolTile.typeInTableCellXY(1, 0, '10');
      tableToolTile.getTableCellXY(1, 0).should('contain', '10');
      tableToolTile.getTableCellXY(1, 1).should('contain', '100');

      cy.log("Link Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table Data 1");
      xyTile.getGraphDot().should('have.length', 2);
    });

    it("Test duplicating graph with an xy-plot (a.k.a. graph)", () => {
      beforeTest(queryParamsMultiDataset);
      cy.collapseResourceTabs();

      clueCanvas.addTile("table");
      tableToolTile.fillTable(tableToolTile.getTableTile(), [[1, 2], [2, 4], [3, 9], [4, 16]]);

      clueCanvas.addTile("graph");
      xyTile.getTile().should("have.length", 1).should('be.visible');
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table Data 1");
      xyTile.getGraphDot().should('have.length', 4);

      clueCanvas.getDuplicateTool().click();
      xyTile.getTile().should("have.length", 2).should('be.visible');
      xyTile.getGraphDot().should('have.length', 8);
    });

    it("Test duplicating graph with a data-card", () => {
      beforeTest(queryParamsMultiDataset);
      cy.collapseResourceTabs();

      let data = [[1, 2], [2, 4], [3, 9], [4, 16]];
      const rows = Math.max(2, ...data.map(row => row.length));

      cy.log("renders Data Card tool tile");
      clueCanvas.addTile("datacard");
      dataCard.getTile().should("exist");

      for (let i=1; i<rows; i++) {
        dataCard.getAddAttributeButton().click();
      }
      for (let i=0; i<data.length; i++) {
        for (let j=0; j<data[i].length; j++) {
          let value = data[i][j];
          dataCard.getAttrValue().eq(j).click().type(`${value}{enter}`);
        }
        dataCard.getAddCardButton().click();
      }

      clueCanvas.addTile("graph");
      xyTile.getTile().should("have.length", 1).should('be.visible');
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkDataCard("Card Deck Data 1");
      xyTile.getGraphDot().should('have.length', 4);

      clueCanvas.getDuplicateTool().click();
      xyTile.getTile().should("have.length", 2).should('be.visible');
      xyTile.getGraphDot().should('have.length', 8);
    });

    it("On initialization from data card containing image URLs, does not graph image URLs", () => {
      beforeTest(`${Cypress.config("qaMothPlotUnitStudent5")}&mouseSensor`);
      clueCanvas.addTile("datacard");
      dataCard.getTile().should("exist");
      dataCard.getAddAttributeButton().click();
      dataCard.getAttrName().eq(0).dblclick().type("Image{enter}");
      dataCard.getAddAttributeButton().click();
      dataCard.getAttrName().eq(1).dblclick().type("Name{enter}");
      dataCard.getAddAttributeButton().click();
      dataCard.getAttrName().eq(2).dblclick().type("Type{enter}");
      dataCard.getAttrValue().eq(0).click().type("https://concord.org/images/energy3d.png{enter}");
      dataCard.getAttrValue().eq(1).click().type("Energy3D{enter}");
      dataCard.getAttrValue().eq(2).click().type("download{enter}");
      dataCard.getAddCardButton().click();
      dataCard.getAttrValue().eq(0).click().type("https://concord.org/images/codap.png{enter}");
      dataCard.getAttrValue().eq(1).click().type("CODAP{enter}");
      dataCard.getAttrValue().eq(2).click().type("web app{enter}");
      dataCard.getGraphItButton().click();
      cy.wait(1000);
      // Image URLs should not be graphed.
      xyTile.getXAxisLabel().should("contain", "Name");
      xyTile.getYAxisLabel().should("contain", "Type");
      // If the user assigns the image URLs to an axis, "<image>" should be used in place of the full URL values
      // for the tick labels.
      xyTile.clickPortalButton("Name");
      xyTile.getPortalButton().contains("Image").should("exist").click();
      cy.get("[data-testid=axis-bottom]").find("text").should("contain", "<image>");
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

    it.skip("Test adding 2 Y Series", () => {
      // Skipped as discussed on Slack - test is failing for reasons we don't understand
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
      xyTile.linkTable("Table Data 1");
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

      clueCanvas.addTile("table");
      tableToolTile.fillTable(tableToolTile.getTableTile().last(), [[1, 2], [2, 4], [3, 9]]);
      clueCanvas.addTile("table");
      tableToolTile.fillTable(tableToolTile.getTableTile().last(), [[1, 1], [2, 5], [3, 1], [4, 5]]);

      tableToolTile.getTableTile().should('have.length', 2);

      cy.log("Link First Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table Data 1");
      xyTile.getXAttributesLabel().should('have.length', 1);
      xyTile.getYAttributesLabel().should('have.length', 1);

      cy.log("Link Second Table");
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable("Table Data 2");

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

    it('Test points by hand', () => {
      beforeTest(queryParamsMultiDataset);
      cy.log('Add XY Plot Tile');
      cy.collapseResourceTabs();
      clueCanvas.addTile('graph');
      xyTile.getTile('.primary-workspace').should('be.visible');
      clueCanvas.toolbarButtonIsDisabled('graph', 'move-points');
      clueCanvas.toolbarButtonIsNotSelected('graph', 'move-points');
      clueCanvas.toolbarButtonIsDisabled('graph', 'add-points');
      clueCanvas.toolbarButtonIsNotSelected('graph', 'add-points');
      xyTile.getEditableAxisBox("left", "max").click().type("100{enter}");
      xyTile.getEditableAxisBox("bottom", "max").click().type("100{enter}");

      // Create manual layer
      clueCanvas.clickToolbarButton('graph', 'add-points-by-hand');
      clueCanvas.toolbarButtonIsDisabled('graph', 'add-points-by-hand'); // only one manual set allowed
      clueCanvas.toolbarButtonIsEnabled('graph', 'move-points');
      clueCanvas.toolbarButtonIsEnabled('graph', 'add-points');
      clueCanvas.toolbarButtonIsSelected('graph', 'add-points'); // automatically turns on "add" mode
      xyTile.getXAttributesLabel().should('have.length', 1).should('contain.text', 'X Variable');
      xyTile.getYAttributesLabel().should('have.length', 1).should('contain.text', 'Y Variable 1');
      xyTile.getLayerName().should('have.length', 1).should('contain.text', 'Added by hand');
      xyTile.getLayerNameInput().should('not.be.visible');

      // Custom axis bounds should not have been changed
      xyTile.getEditableAxisBox("left", "max").should('contain.text', '100');
      xyTile.getEditableAxisBox("bottom", "max").should('contain.text', '100');

      // Rename manual layer
      xyTile.getLayerNameEditButton().click();
      xyTile.getLayerNameEditButton().should('have.length', 0);
      xyTile.getLayerNameInput().should('be.visible').type('Renamed{enter}');
      xyTile.getLayerNameInput().should('not.be.visible');
      xyTile.getLayerName().should('have.length', 1).should('contain.text', 'Renamed');

      // Add points
      xyTile.getGraphDot().should('have.length', 0);
      xyTile.getTile('.primary-workspace').should('have.length', 1);
      xyTile.getGraphBackground().should('have.length', 1).click(150, 50);
      xyTile.getGraphBackground().click(200, 100);
      xyTile.getGraphDot().should('have.length', 2);

      // Switch to 'select/move' mode
      clueCanvas.clickToolbarButton('graph', 'move-points');
      clueCanvas.toolbarButtonIsSelected('graph', 'move-points');
      clueCanvas.toolbarButtonIsNotSelected('graph', 'add-points');
      xyTile.getGraphBackground().click(250, 100); // should not add a point
      xyTile.getGraphDot().should('have.length', 2);

      // Drag a point to reposition.  Should start out where we initially clicked
      xAttributeOfTransform(xyTile.getGraphDot().eq(0)).should("be.closeTo", 150, 10);
      yAttributeOfTransform(xyTile.getGraphDot().eq(0)).should("be.closeTo", 50, 10);
      clueCanvas.clickToolbarButton('graph', 'toggle-lock'); // so that we can test position without rescale happening

      xyTile.getGraphDot().eq(0).then(elt => {
        const currentPos = elt[0].getBoundingClientRect();
        cy.window().then(win => {
          xyTile.getGraphDot().eq(0).children('circle').eq(1)
            .trigger("mousedown", { force: true, view: win })
            .trigger("mousemove", { force: true, view: win, clientX: currentPos.x+25, clientY: currentPos.y+25 })
            .trigger("mouseup", { force: true, view: win, clientX: currentPos.x+25, clientY: currentPos.y+25 });
        });
        cy.wait(500); // animation
        xAttributeOfTransform(xyTile.getGraphDot().eq(0)).should("be.closeTo", 175, 10);
        yAttributeOfTransform(xyTile.getGraphDot().eq(0)).should("be.closeTo", 75, 10);
        clueCanvas.clickToolbarButton('graph', 'toggle-lock'); // unlock
      });

      // Click toolbar button again to leave edit mode
      clueCanvas.clickToolbarButton('graph', 'move-points');
      clueCanvas.toolbarButtonIsNotSelected('graph', 'move-points');
      clueCanvas.toolbarButtonIsNotSelected('graph', 'add-points');

      // Delete point with toolbar button
      xyTile.getGraphDot().eq(0).children('circle.inner-circle').click();
      xyTile.getGraphDot().eq(0).children('circle.outer-circle').should("have.class", "selected");
      clueCanvas.clickToolbarButton('graph', 'delete');
      xyTile.getGraphDot().should('have.length', 1);

      // Delete point with keyboard shortcut
      xyTile.getGraphDot().eq(0).children('circle.inner-circle').click();
      xyTile.getGraphDot().eq(0).children('circle.outer-circle').should("have.class", "selected");
      xyTile.getGraphDot().eq(0).type("{backspace}");
      xyTile.getGraphDot().should('have.length', 0);
    });

    it("Test movable line", () => {
      beforeTest(queryParamsMultiDataset);
      clueCanvas.addTile("graph");
      clueCanvas.toolbarButtonIsEnabled("graph", "movable-line");
      clueCanvas.toolbarButtonIsNotSelected("graph", "movable-line");
      xyTile.getMovableLine().should("have.length", 0);
      xyTile.getMovableLineEquationContainer().should("have.length", 0);

      // Add movable line
      clueCanvas.clickToolbarButton("graph", "movable-line");
      clueCanvas.toolbarButtonIsEnabled("graph", "movable-line");
      xyTile.getMovableLine().should("have.length", 1);
      xyTile.getMovableLineCover().should("have.length", 1);
      xyTile.getMovableLineHandle().should("have.length", 2);
      xyTile.getMovableLineEquationContainer()
        .should("have.length", 1)
        // .and("be.visible") -- fails, since there's a (transparent) element covering it
        .and("contain.html", "<em>time</em>")  // from default axis labels of the unit
        .and("contain.html", "<em>dist</em>");
      // this is how visibility is actually accomplished:
      xyTile.getMovableLineWrapper().should("have.class", "fadeIn").and("not.have.class", "fadeOut");

      // Drag movable line
      xyTile.getMovableLineEquationSlope().then(origSlope => {
        xyTile.getMovableLineEquationIntercept().then(origIntercept => {
          xyTile.getMovableLineCover().trigger("mousedown", { force: true, eventConstructor: 'MouseEvent' });
          xyTile.getMovableLineCover().trigger("mousemove", 50, 0, { force: true, eventConstructor: 'MouseEvent' });
          xyTile.getMovableLineCover().trigger("mouseup", { force: true, eventConstructor: 'MouseEvent' });
          xyTile.getMovableLineEquationSlope().should("equal", origSlope);
          xyTile.getMovableLineEquationIntercept().should("be.greaterThan", origIntercept);
        });
      });

      // Now drag the bottom handle up enough to make the slope negative
      xyTile.getMovableLineEquationSlope().should("be.greaterThan", 0);
      xyTile.getMovableLineHandle('lower').trigger("mousedown", { force: true, eventConstructor: 'MouseEvent' });
      xyTile.getMovableLineHandle('lower').trigger("mousemove", 0, -100, { force: true, eventConstructor: 'MouseEvent' });
      xyTile.getMovableLineHandle('lower').trigger("mouseup", { force: true, eventConstructor: 'MouseEvent' });
      xyTile.getMovableLineEquationSlope().should("be.lessThan", 0);
      // Then drag the upper handle up and make slope positive again
      xyTile.getMovableLineHandle('upper').trigger("mousedown", { force: true, eventConstructor: 'MouseEvent' });
      xyTile.getMovableLineHandle('upper').trigger("mousemove", 0, -100, { force: true, eventConstructor: 'MouseEvent' });
      xyTile.getMovableLineHandle('upper').trigger("mouseup", { force: true, eventConstructor: 'MouseEvent' });
      xyTile.getMovableLineEquationSlope().should("be.greaterThan", 0);

      // Add another movable line
      clueCanvas.clickToolbarButton("graph", "movable-line");
      clueCanvas.toolbarButtonIsEnabled("graph", "movable-line");
      xyTile.getMovableLine().should("have.length", 2);
      xyTile.getMovableLineCover().should("have.length", 2);
      xyTile.getMovableLineHandle().should("have.length", 4);
      xyTile.getMovableLineEquationContainer().should("have.length", 2);

      // Select a movable line and delete it using the toolbar button
      xyTile.getMovableLineCover().eq(1).click({force: true});
      clueCanvas.clickToolbarButton("graph", "delete");
      xyTile.getMovableLine().should("have.length", 1);

    });
  });
});
