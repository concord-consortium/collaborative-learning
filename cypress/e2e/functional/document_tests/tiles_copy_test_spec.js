import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import ExpressionToolTile from '../../../support/elements/tile/ExpressionToolTile';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';
import DataCardToolTile from '../../../support/elements/tile/DataCardToolTile';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import SimulatorTile from '../../../support/elements/tile/SimulatorTile';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import XYPlotToolTile from "../../../support/elements/tile/XYPlotToolTile";
import ArrowAnnotation from "../../../support/elements/tile/ArrowAnnotation";
import TextToolTile from '../../../support/elements/tile/TextToolTile';

const student5 = `${Cypress.config("qaUnitStudent5")}`;
const student6 = `${Cypress.config("qaUnitStudent6")}`;

let clueCanvas = new ClueCanvas,
  tableToolTile = new TableToolTile,
  geometryToolTile = new GeometryToolTile,
  drawToolTile = new DrawToolTile,
  exp = new ExpressionToolTile,
  numberlineToolTile = new NumberlineToolTile,
  dc = new DataCardToolTile,
  dataflowToolTile = new DataflowToolTile,
  simulatorTile = new SimulatorTile,
  diagramTile = new DiagramToolTile,
  graphTile = new XYPlotToolTile,
  aa = new ArrowAnnotation,
  canvas = new Canvas,
  textToolTile = new TextToolTile;

const imageName = "Image Tile";
const simName = "Test Simulation";
const diagramName = "Test Diagram";
const categoricalGraphName = "Categorical Graph Test";
const categoricalGraphCopyName = "Categorical Graph Test 1";

const studentWorkspace = 'QA 1.1 Solving a Mystery with Proportional Reasoning';
const studentWorkspaceCopyTiles = 'Test Workspace Copy Tiles';
const studentClassWorkCopyTiles = 'Test Class Work Copy Tiles';

const tiles1 = [
  { "name": "table" },
  { "name": "geometry" },
  { "name": "drawing" },
  { "name": "expression" },
  { "name": "numberline" },
  { "name": "image" }
];
const tiles2 = [
  { "name": "data-card" },
  { "name": "dataflow" },
  { "name": "simulator" },
  { "name": "graph" },
  { "name": "diagram" }
];

function beforeTest(queryParams) {
  cy.visit(queryParams);
  cy.waitForLoad();
}

function testPrimaryWorkspace1() {
  // Make sure the table tile were copied correctly
  cy.get('.primary-workspace .rdg-row .rdg-cell').eq(1).should('contain', '3');
  cy.get('.primary-workspace .rdg-row .rdg-cell').eq(2).should('contain', '2.5');
  // Make sure the geometry tile were copied correctly
  // This could be 3 or more depending if a geometry tile was already selected before dragging as the drag
  // select behavior changed to include the previously selected tiles in the drag if the user selects tile(s)
  // and then clicks directly on the drag handle on another tile to drag.
  cy.get('.primary-workspace .geometry-content.editable ellipse[display="inline"]').should('have.length.gte', 3);
  // Make sure the drawing tile were copied correctly
  drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
  // Make sure the expression tile were copied correctly
  cy.get('.primary-workspace .expression-math-area math-field').should("have.value", "a=\\pi r^2");
  // Make sure the numberline tile were copied correctly
  cy.get('.primary-workspace .numberline-tool-container .point-inner-circle').not(".mouse-follow-point").should('have.length', 2);
  // Make sure the image tile were copied correctly
  cy.get('.primary-workspace .image-tool .editable-tile-title-text').should("contain", imageName);
  // Make sure the annotations were copied correctly
  aa.getAnnotationArrows().should("have.length", 2);

  canvas.deleteDocument();
}

function testPrimaryWorkspace2() {
  // Make sure the datacard tile were copied correctly
  dc.getAttrName().contains("Attr1 Name");
  dc.getAttrValueInput().invoke('val').should('eq', "ocean");
  // Make sure the dataflow tile were copied correctly
  dataflowToolTile.getNodeTitle().invoke("val").should("include", "Number");
  // Make sure the simulator tile were copied correctly
  simulatorTile.getTileTitle().should("contain", simName);
  // Make sure the XY plot tile were copied correctly
  cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').should("contain", "XY Plot test");
  //Verify my work document tiles are copied correctly
  diagramTile.getTileTitleText().should("contain", diagramName);

  canvas.deleteDocument();
}

function dragTile() {
  cy.root().click();
  let dataTransfer = new DataTransfer();
  // The dragstart event is only sent to elements with the "draggable" attribute.
  // There is a mouse down event that is sent first to the actual element.
  // TODO: we could make a general dragging utility
  cy.get(".tool-tile-drag-handle").then($handle => {
    const rect = $handle[0].getBoundingClientRect();
    const clientX = rect.left + rect.width/2;
    const clientY = rect.top + rect.height/2;

    // A real user event will have a mouseup around the dragstart
    cy.wrap($handle).trigger('mousedown', {
      // We pass clientX and clientY so we are consistent with the next trigger
      clientX, clientY,

      // The scrollbar covers the handle if cypress scrolls to it
      // The component should be visible because the click above scrolled the tile the top
      // and the handle is at the top
      scrollBehavior: false });

    cy.wrap($handle).trigger('dragstart', { dataTransfer,
      // We have to explicity set the clientX and clientY because cypress will just use
      // the center of the target instead of the location of the previous trigger
      clientX, clientY,
      // The scrollbar can cover the handle if cypress scrolls
      scrollBehavior: false });
  });
  cy.document().find('.single-workspace .canvas .document-content').first()
    .trigger('drop', { force: true, dataTransfer });
  cy.get(".tool-tile-drag-handle").trigger('mouseup', { force: true });
}

context('Test copy tiles from one document to other document', function () {
  it('Verify table, geometry, drawing, expression, numberline and image tiles are copied correctly', function () {
    beforeTest(student5);
    cy.log('Add table tile');
    clueCanvas.addTile('table');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.typeInTableCell(1, '3');
      tableToolTile.getTableCell().eq(1).should('contain', '3');
      tableToolTile.typeInTableCell(2, '2.5');
      tableToolTile.getTableCell().eq(2).should('contain', '2.5');
    });

    cy.log('Add Sparrows to table tile');
    aa.getAnnotationModeButton().click(); // sparrow mode on
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("have.length", 2);
    // Curved sparrow between the two cells
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);
    // Straight sparrow from one of the cells
    aa.getAnnotationMenuExpander().click();
    aa.getStraightArrowToolbarButton().click();
    aa.getAnnotationModeButton().should("have.attr", "title", "Sparrow: straight");
    aa.getAnnotationButtons().eq(1).click({force: true});
    aa.getAnnotationSvg().click(300, 100);
    aa.getAnnotationArrows().should("have.length", 2);
    aa.getAnnotationModeButton().click(); // sparrow mode off

    cy.log('Add geometry tile');
    clueCanvas.addTile('geometry');
    cy.get('.spacer').click();
    geometryToolTile.getGeometryTile().last().click();
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(5, 5);
    geometryToolTile.clickGraphPosition(10, 5);
    geometryToolTile.clickGraphPosition(10, 10);
    geometryToolTile.getGraphPoint().should('have.length', 3);
    geometryToolTile.getPhantomGraphPoint().should('exist');

    cy.log('Add drawing tile');
    clueCanvas.addTile("drawing");
    drawToolTile.drawRectangle(250, 50, -150, 100);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);

    cy.log("Add expression tile");
    clueCanvas.addTile("expression");
    exp.getMathField().should("have.value", "a=\\pi r^2");

    cy.log("Add number line tile");
    clueCanvas.addTile("numberline");
    numberlineToolTile.setToolbarPoint(); //click Point in order to add points to numberline
    numberlineToolTile.addPointOnNumberlineTick(-4.0);
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    numberlineToolTile.getPointsOnGraph().should('have.length', 2);

    cy.log("Add image tile");
    clueCanvas.addTile('image');
    cy.get('.primary-workspace .image-tool .editable-tile-title-text').first().should("contain", "Image 1");
    cy.get('.primary-workspace .image-tool .editable-tile-title-text').first().click();
    cy.get('.primary-workspace .image-tool .editable-tile-title').first().type(imageName + '{enter}');
    cy.get('.primary-workspace .image-tool .editable-tile-title-text').should("contain", imageName);

    //Publish the document
    canvas.publishCanvas("investigation");

    // Unpublished document tiles copy
    cy.log('My Work tab');
    cy.openTopTab('my-work');
    cy.openSection("my-work", "workspaces");
    cy.openDocumentThumbnail('my-work', 'workspaces', studentWorkspace);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspaceCopyTiles, "my-work");
    cy.wait(5000);

    tiles1.forEach(tool => {
      cy.get(`.nav-tab-panel .my-work .${tool.name}-tool-tile`)
        .first().within(dragTile);
    });

    //Verify my work document tiles are copied correctly
    testPrimaryWorkspace1();

    //Load student 6
    cy.visit(student6);
    cy.waitForLoad();

    // Published document tiles copy
    cy.log('Class work tab');
    cy.openTopTab('class-work');
    cy.openSection("class-work", "workspaces");
    cy.openDocumentThumbnail('class-work', 'workspaces', studentWorkspace);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentClassWorkCopyTiles, "my-work");
    cy.wait(5000);

    tiles1.forEach(tool => {
      cy.get(`.nav-tab-panel .class-work .${tool.name}-tool-tile`)
        .first().within(dragTile);
    });

    //Verify class work document tiles are copied correctly
    testPrimaryWorkspace1();

  });
  it('Verify datacard, dataflow, sim, graph and diagram tiles are copied correctly', function () {
    beforeTest(student5);

    cy.log("Add data card tool tile");
    clueCanvas.addTile("datacard");
    dc.getAttrName().dblclick().type("Attr1 Name{enter}");
    dc.getAttrName().contains("Attr1 Name");
    dc.getAttrValue().click().type("ocean{enter}");
    dc.getTile().click();
    dc.getAttrValueInput().invoke('val').should('eq', "ocean");

    cy.log('Add dataflow tile');
    clueCanvas.addTile("dataflow");
    const numberNode = "number";
    dataflowToolTile.getCreateNodeButton(numberNode).click();
    dataflowToolTile.getNode(numberNode).should("exist");
    dataflowToolTile.getNodeTitle().invoke("val").should("include", "Number");

    cy.log('Add simulator tile');
    clueCanvas.addTile("simulator");
    simulatorTile.getTileTitle().should("contain", "Simulation 1");
    simulatorTile.getSimulatorTileTitle().click();
    simulatorTile.getSimulatorTileTitle().type(simName + '{enter}');
    simulatorTile.getTileTitle().should("contain", simName);

    cy.log("Add XY plot tile");
    clueCanvas.addTile("graph");
    const title = "XY Plot test";
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').first().should("contain", "Graph 1");
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').first().click();
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title').first().type(title + '{enter}');
    cy.get('.primary-workspace .graph-wrapper .editable-tile-title-text').should("contain", title);

    cy.log('Add diagram tile');
    clueCanvas.addTile("diagram");
    diagramTile.getTileTitleText().should("contain", "Diagram 1");
    diagramTile.getTileTitleContainer().click();
    diagramTile.getTileTitleContainer().type(diagramName + '{enter}');
    diagramTile.getTileTitleText().should("contain", diagramName);

    //Publish the document
    canvas.publishCanvas("investigation");

    // Unpublished document tiles copy
    cy.log('My Work tab');
    cy.openTopTab('my-work');
    cy.openSection("my-work", "workspaces");
    cy.openDocumentThumbnail('my-work', 'workspaces', studentWorkspace);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentWorkspaceCopyTiles, "my-work");
    cy.wait(5000);

    tiles2.forEach(tool => {
      cy.get(`.nav-tab-panel .my-work .${tool.name}-tool-tile`)
        .first().within(dragTile);
    });

    //Verify my work document tiles are copied correctly
    testPrimaryWorkspace2();

    //Load student 6
    cy.visit(student6);
    cy.waitForLoad();

    // Published document tiles copy
    cy.log('Class work tab');
    cy.openTopTab('class-work');
    cy.openSection("class-work", "workspaces");
    cy.openDocumentThumbnail('class-work', 'workspaces', studentWorkspace);

    //Create new document
    canvas.createNewExtraDocumentFromFileMenu(studentClassWorkCopyTiles, "my-work");
    cy.wait(5000);

    tiles2.forEach(tool => {
      cy.get(`.nav-tab-panel .class-work .${tool.name}-tool-tile`)
        .first().within(dragTile);
    });

    //Verify class work document tiles are copied correctly
    testPrimaryWorkspace2();

  });
  it.only('checks for Select/Deselect all and Copy to Workspace', function () {
    beforeTest(student5);

    // Navigate to Problem tab where content already exists
    cy.openTopTab('problems');
    cy.openProblemSection('Initial Challenge');

    // Initially verify Copy to Workspace button is disabled when no tiles are selected
    cy.log('Verify Copy to Workspace button is disabled when no tiles are selected');
    cy.get('[data-testid="tool-copytoworkspace"]').should('have.class', 'disabled');

    // Click Select All button to select all tiles
    cy.get('[data-testid="tool-selectall"]').click();

    // Verify Copy to Workspace button is enabled when all tiles are selected
    cy.get('[data-testid="tool-copytoworkspace"]')
      .should('have.class', 'enabled');

    // Click Select All button again to deselect all tiles since all tiles are currently selected
    cy.get('[data-testid="tool-selectall"]').click();

    // Verify Copy to Workspace button is disabled again
    cy.get('[data-testid="tool-copytoworkspace"]').should('have.class', 'disabled');
  });
});

context("Test copy tile within a document", function () {
  it("Copies a graph tile within a document", function () {
    beforeTest(student5);

    // Add table tile and populate it with categorical data.
    cy.log("Add table tile with categorical data");
    clueCanvas.addTile("table");
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.typeInTableCellXY(0, 0, "small");
      tableToolTile.getTableCellXY(0, 0).should("contain", "small");
      tableToolTile.typeInTableCellXY(1, 0, "medium");
      tableToolTile.getTableCellXY(1, 0).should("contain", "medium");
      tableToolTile.typeInTableCellXY(0, 1, "red");
      tableToolTile.getTableCellXY(0, 1).should("contain", "red");
      tableToolTile.typeInTableCellXY(1, 1, "green");
      tableToolTile.getTableCellXY(1, 1).should("contain", "green");
    });

    // Graph the table data in a new graph tile
    cy.get("[data-original-title='Graph It!']").click();
    cy.get("[data-test=link-tile-select]").select("New Graph");
    cy.get(".modal-button").contains("Graph It").click();
    graphTile.getTile().should("have.length", 1);
    graphTile.getXYPlotTitle().first().should("contain", "Graph 1");
    graphTile.getXYPlotTitle().first().click();
    cy.get(".primary-workspace .graph-wrapper .editable-tile-title").first().type(categoricalGraphName + "{enter}");
    graphTile.getXYPlotTitle().first().should("contain", categoricalGraphName);
    graphTile.getGraphDot().should("have.length", 2).each(($g) => {
      cy.wrap($g).should("have.attr", "transform").should("not.be.empty");
    });

    // Click on new graph tile to select it, then copy it
    graphTile.getTile().first().click();
    cy.get("[data-testid=tool-duplicate]").click();
    graphTile.getTile().should("have.length", 2);
    graphTile.getXYPlotTitle().eq(1).should("contain", categoricalGraphCopyName);
    graphTile.getTile().eq(1).find("g.graph-dot").should("have.length", 2).each(($g) => {
      cy.wrap($g).should("have.attr", "transform").should("not.be.empty");
    });

  });
});

describe('Copy to Workspace', () => {
  it('copies tiles from Problem tab to workspace', () => {
    // Visit the test document
    cy.visit('/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=./demo/units/qa/content.json');
    cy.waitForLoad();

    // Open the Problems tab
    cy.get('.top-tab.tab-problems').click();
    cy.get('.top-tab.tab-problems').invoke('attr', 'class').should('contain', 'selected');

    // Open the Initial Challenge section
    cy.openProblemSection('Initial Challenge');
    cy.clickProblemResourceTile('Initial Challenge', 0);
    cy.wait(1000); // Give time for content to load

    // Store the first tile's content for later verification
    cy.get('.problem-panel .document-content .tile-row').first()
      .invoke('text')
      .as('tileContent');

    // Initially, the copy button should be disabled
    cy.get('[data-testid="tool-copytoworkspace"]')
      .should('have.class', 'disabled');

    // Now the copy button should be enabled
    cy.get('[data-testid="tool-copytoworkspace"]')
      .should('not.have.class', 'disabled')
      .click();

    // Verify the tile was copied to the workspace
    cy.get('@tileContent').then((content) => {
      cy.get('.canvas-area .document-content .tile-row')
        .should('contain', content);
    });
  });
});
