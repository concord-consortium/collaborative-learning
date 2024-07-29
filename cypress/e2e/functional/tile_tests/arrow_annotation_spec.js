import ClueCanvas from '../../../support/elements/common/cCanvas';
import ArrowAnnotation from '../../../support/elements/tile/ArrowAnnotation';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import DiagramToolTile from '../../../support/elements/tile/DiagramToolTile';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import NumberlineToolTile from '../../../support/elements/tile/NumberlineToolTile';
import SimulatorTile from '../../../support/elements/tile/SimulatorTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';

const aa = new ArrowAnnotation;
const clueCanvas = new ClueCanvas;
const dataflowTile = new DataflowToolTile;
const diagramToolTile = new DiagramToolTile;
const drawToolTile = new DrawToolTile;
const geometryToolTile = new GeometryToolTile;
const numberlineToolTile = new NumberlineToolTile;
const simulatorTile = new SimulatorTile;
const tableToolTile = new TableToolTile;
const xyTile = new XYPlotToolTile;

const queryParams = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const queryParamsQa = `${Cypress.config("qaUnitStudent7Investigation3")}`;

// Note copied from drawing tile test
// NOTE: For some reason cypress+chrome thinks that the SVG elements are in a
// scrollable container. Because of this when cypress does an action on a SVG
// element like click or trigger, by default it tries to scroll this element to
// the top of the containers visible area. Likewise when looking at the test
// results after a run is complete the cypress app will automatically scroll
// this area when you select a cypress `get` that is selecting a SVG element.
//
// - The first issue is addressed here by adding `scrollBehavior: false` to each
//   action that works with an SVG element.
// - The second issue has no simple solution, so you need to remember it when
//   looking at the results.
// - The best solution to both problems would be to figure out the CSS necessary
//   so cypress+chrome simply cannot scroll the container.

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context('Arrow Annotations (Sparrows)', function () {
  it("can add arrows to draw tiles", () => {
    beforeTest(queryParams);
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTile().should("exist");
    drawToolTile.getTileTitle().should("exist");

    cy.log("Add two rectangles and an ellipse");
    drawToolTile.drawRectangle(50, 50);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
    drawToolTile.drawEllipse(200, 50);
    drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);
    drawToolTile.drawRectangle(400, 100);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 2);

    cy.log("Annotation buttons only appear in sparrow mode");
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("have.length", 3);

    cy.log("Pressing a tile button exits sparrow mode");
    clueCanvas.addTile("drawing");
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.clickArrowToolbarButton();

    cy.log("Pressing select button exits sparrow mode");
    aa.getAnnotationLayer().should("have.class", "editing");
    clueCanvas.getSelectTool().click();
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.clickArrowToolbarButton();

    cy.log("Double-clicking background exits sparrow mode");
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationLayer().dblclick();
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.clickArrowToolbarButton();

    cy.log("ESC key exits sparrow mode");
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationLayer().type("{esc}");
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getArrowToolbarButton().type("{esc}");
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.clickArrowToolbarButton();

    cy.log("Can draw an arrow between two objects");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationTextDisplays().should("not.exist");
    aa.getAnnotationTextInputs().should("not.exist");
    aa.getPreviewArrow().should("not.exist");
    aa.getAnnotationButtons().first().click({ force: true });
    aa.getPreviewArrow().should("exist");
    aa.getAnnotationButtons().eq(1).click({ force: true });
    aa.getPreviewArrow().should("not.exist");
    aa.getAnnotationArrows().should("exist");
    aa.getAnnotationTextInputs().should("exist");

    // Add a second arrow
    aa.getAnnotationButtons().eq(2).click({ force: true });
    aa.getPreviewArrow().should("exist");
    aa.getAnnotationButtons().eq(1).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 2);

    cy.log("Can select arrows");
    // Click to select
    aa.getAnnotationSparrowGroups().should("not.have.class", "selected");
    aa.getAnnotationBackgroundArrowPaths().eq(0).click({ force: true });
    aa.getAnnotationSparrowGroups().eq(0).should("have.class", "selected");
    aa.getAnnotationSparrowGroups().eq(1).should("not.have.class", "selected");

    // Click again leaves it selected
    aa.getAnnotationBackgroundArrowPaths().eq(0).click({ force: true });
    aa.getAnnotationSparrowGroups().eq(0).should("have.class", "selected");
    aa.getAnnotationSparrowGroups().eq(1).should("not.have.class", "selected");

    // Click another one replaces selection
    aa.getAnnotationBackgroundArrowPaths().eq(1).click({ force: true });
    aa.getAnnotationSparrowGroups().eq(0).should("not.have.class", "selected");
    aa.getAnnotationSparrowGroups().eq(1).should("have.class", "selected");

    // Click with shift adds to selection
    aa.getAnnotationBackgroundArrowPaths().eq(0).click({ force: true, shiftKey: true });
    aa.getAnnotationSparrowGroups().eq(0).should("have.class", "selected");
    aa.getAnnotationSparrowGroups().eq(1).should("have.class", "selected");

    // Click with shift removes from selection
    aa.getAnnotationBackgroundArrowPaths().eq(1).click({ force: true, shiftKey: true });
    aa.getAnnotationSparrowGroups().eq(0).should("have.class", "selected");
    aa.getAnnotationSparrowGroups().eq(1).should("not.have.class", "selected");

    // Click background unselects all
    aa.getAnnotationLayer().click();
    aa.getAnnotationSparrowGroups().eq(0).should("not.have.class", "selected");
    aa.getAnnotationSparrowGroups().eq(1).should("not.have.class", "selected");

    // Select & delete key to delete
    aa.getAnnotationBackgroundArrowPaths().eq(1).click({ force: true });
    aa.getAnnotationSparrowGroups().eq(1).should("have.class", "selected");
    aa.getAnnotationLayer().type('{del}');
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Can only edit text in sparrow mode");
    aa.clickArrowToolbarButton();
    aa.getAnnotationTextInputs().should("not.exist");
    aa.getAnnotationTextDisplays().first().should("have.css", "pointer-events", "none");
    aa.getAnnotationTextInputs().should("not.exist");
    aa.clickArrowToolbarButton();
    aa.getAnnotationTextDisplays().first().dblclick();
    aa.getAnnotationTextInputs().should("exist");

    cy.log("Can change text by pushing enter");
    const text1 = "test text 1";
    aa.getAnnotationTextInputs().type(`${text1}{enter}`);
    aa.getAnnotationTextDisplays().first().should("have.text", text1);

    cy.log("Can change text by blurring");
    const text2 = "1 txet tset";
    const combinedText = text1 + text2;
    aa.getAnnotationTextDisplays().first().dblclick();
    aa.getAnnotationTextInputs().first().type(text2);
    drawToolTile.getDrawTile().click({ force: true });
    aa.getAnnotationTextDisplays().first().should("have.text", combinedText);

    cy.log("Can cancel text by pressing escape");
    const text3 = "mistake";
    aa.getAnnotationTextDisplays().first().dblclick();
    aa.getAnnotationTextInputs().first().type(text3).should("have.value", combinedText + text3);
    aa.getAnnotationTextInputs().first().type("{esc}");
    aa.getAnnotationTextDisplays().first().should("have.text", combinedText);

    // TODO Test position of sparrow

    cy.log("Can hide annotations by pressing the hide button");
    aa.clickArrowToolbarButton();
    aa.clickHideAnnotationsButton();
    aa.getAnnotationLayer().should("not.be.visible");

    cy.log("Arrows become visible when you enter sparrow mode");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("be.visible");

    cy.log("Arrows persist on reload");
    aa.getAnnotationArrows().should("exist");
    cy.reload();
    aa.getAnnotationArrows().should("exist");

    cy.log("Can create sparrows across two tiles");
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawToolVector().eq(0).click();
    drawToolTile.getDrawTile().eq(1)
      .trigger("pointerdown", 150, 50)
      .trigger("pointermove", 100, 150)
      .trigger("pointerup", 100, 50);
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 4);
    aa.getAnnotationButtons().first().click({ force: true });
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationArrows().should("have.length", 2);

    cy.log("Can delete sparrows");
    aa.getAnnotationDeleteButtons().eq(1).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("can add arrows to table tiles", () => {
    beforeTest(queryParams);
    clueCanvas.addTile("table");

    cy.log("Annotation buttons only appear for actual cells");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    tableToolTile.typeInTableCell(1, '3');
    tableToolTile.typeInTableCell(2, '2');
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 2);

    cy.log("Can create an annotation arrow between two cells");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Can duplicate annotations contained within one tile");
    aa.clickArrowToolbarButton();
    tableToolTile.getTableCell().eq(1).click();
    clueCanvas.getDuplicateTool().click();
    aa.clickArrowToolbarButton(); // To force a rerender of the annotation layer
    aa.clickArrowToolbarButton();
    aa.getAnnotationArrows().should("have.length", 2);

    cy.log("Can duplicate annotations that span multiple tiles");
    aa.clickArrowToolbarButton();
    // Delete the copied sparrow so only the original remains
    aa.getAnnotationDeleteButtons().eq(1).click();
    // Create a sparrow between the two tables
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationButtons().eq(1).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 2);
    aa.clickArrowToolbarButton();
    // Copy the original table. This has one internal sparrow and one sparrow shared with the other tile.
    tableToolTile.getTableCell().eq(0).click();
    clueCanvas.getDuplicateTool().click();
    aa.clickArrowToolbarButton(); // To force a rerender of the annotation layer
    aa.clickArrowToolbarButton();
    // Both sparrows should have been copied.
    aa.getAnnotationArrows().should("have.length", 4);
  });

  it("can add arrows to geometry tiles", { scrollBehavior: 'nearest'}, () => {
    beforeTest(queryParams);
    clueCanvas.addTile("geometry");

    cy.log("Annotation buttons appear for points, polygons, and segments");
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    aa.clickArrowToolbarButton(); // sparrow mode on
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");

    aa.clickArrowToolbarButton(); // sparrow mode off
    geometryToolTile.getGeometryTile().click(); // select tile
    geometryToolTile.clickGraphPosition(10, 5);
    geometryToolTile.clickGraphPosition(15, 10);
    geometryToolTile.clickGraphPosition(20, 5);
    geometryToolTile.clickGraphPosition(10, 5); // close polygon

    aa.clickArrowToolbarButton(); // sparrow mode on
    // 3 points + 3 segments + 1 polygon = 7
    aa.getAnnotationButtons().should("have.length", 7);

    cy.log("Can add an arrow to geometry objects");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(6).click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.getAnnotationDeleteButtons().eq(0).click();

    // Remove all the points and polygons
    aa.clickArrowToolbarButton(); // sparrow mode off
    geometryToolTile.getGeometryTile().click(); // select tile
    clueCanvas.clickToolbarButton('geometry', 'select'); // switch to select mode
    geometryToolTile.getGraphPoint().eq(2).click();
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPoint().eq(1).click();
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPoint().eq(0).click();
    clueCanvas.clickToolbarButton('geometry', 'delete');
    aa.getAnnotationButtons().should("have.length", 0);
    aa.getAnnotationArrows().should("have.length", 0);

    cy.log("Add a table and check annotating linked points");
    clueCanvas.addTile("table");
    tableToolTile.typeInTableCellXY(0, 0, 1);
    tableToolTile.typeInTableCellXY(0, 1, 2);
    tableToolTile.typeInTableCellXY(1, 0, 3);
    tableToolTile.typeInTableCellXY(1, 1, 4);
    cy.linkTableToTile('Table Data 1', "Coordinate Grid 1");
    aa.clickArrowToolbarButton(); // sparrow mode on
    aa.getAnnotationButtons().should("have.length", 6); // 2 dots + 4 table cells
    clueCanvas.getSingleWorkspaceDocumentContent().scrollTo("top");
    aa.getAnnotationButtons().eq(0).scrollIntoView().click();
    aa.getAnnotationButtons().eq(1).scrollIntoView().click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.getAnnotationDeleteButtons().eq(0).click();
    aa.getAnnotationArrows().should("have.length", 0);
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(2).click();
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("can add annotations to numberline tiles", () => {
    beforeTest(queryParams);
    clueCanvas.addTile("numberline");

    cy.log("annotations buttons don't exist when empty numberline");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");
    // Disable the annotation tool again so there isn't a layer on top
    // of the numberline tile
    aa.clickArrowToolbarButton();

    cy.log("add points so we can add annotations");
    // Click on tile to get the tool bar to show up
    numberlineToolTile.getNumberlineTile().click();
    // Switch to point adding mode
    numberlineToolTile.setToolbarPoint();
    numberlineToolTile.addPointOnNumberlineTick(-4.0);
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    aa.clickArrowToolbarButton();

    aa.getAnnotationButtons().should("exist");
    aa.getAnnotationButtons().should("have.length", 2);
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("can add arrows to xy plot tiles", () => {
    beforeTest(queryParams);
    clueCanvas.addTile("graph");
    clueCanvas.addTile("table");
    tableToolTile.getAddColumnButton().click();
    tableToolTile.typeInTableCell(1, '3');
    tableToolTile.typeInTableCell(2, '2');
    tableToolTile.typeInTableCell(3, '2');
    tableToolTile.typeInTableCell(6, '2');
    tableToolTile.typeInTableCell(7, '4');
    tableToolTile.typeInTableCell(8, '2');
    tableToolTile.typeInTableCell(11, '1');
    tableToolTile.typeInTableCell(12, '5');
    tableToolTile.typeInTableCell(13, '2');

    cy.log("Annotation buttons appear for dots");
    aa.clickArrowToolbarButton();
    // Table cells should have buttons, but there are no dots until the xy plot is connected to the table's dataset
    aa.getAnnotationButtons().should("have.length", 9);
    aa.clickArrowToolbarButton();
    xyTile.getTile().click();
    clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
    xyTile.linkTable("Table Data 1");
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 12);

    cy.log("Can add an arrow to xy plot dots");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Dots are considered different objects when the axes change");
    aa.clickArrowToolbarButton();
    xyTile.selectYAttribute("y2");
    aa.getAnnotationArrows().should("not.exist");

    cy.log("Annotation buttons appear for variable values");
    const varName = "var1";

    clueCanvas.addTile("diagram");
    diagramToolTile.getDiagramTile().should("exist").click();
    clueCanvas.clickToolbarButton("diagram", "new-variable");
    diagramToolTile.getDiagramDialog().should("exist");
    diagramToolTile.getDialogField("name").should("exist").type(varName);
    diagramToolTile.getDialogField("value").should("exist").type("3");
    diagramToolTile.getDialogOkButton().click();
    diagramToolTile.getVariableCard().should("exist");

    // Link to diagram as well as table
    xyTile.getTile().click();
    clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
    xyTile.linkTable("Diagram 1");
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 12);
    aa.clickArrowToolbarButton();

    xyTile.selectXVariable(varName);
    xyTile.selectYVariable(varName);
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 13);
    aa.clickArrowToolbarButton();

    cy.log("Can add an arrow to variable dots");
    xyTile.getTile().click();
    aa.clickArrowToolbarButton();
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.getAnnotationDeleteButtons().eq(0).click(); // Remove arrow
    aa.getAnnotationArrows().should("have.length", 0);
    aa.clickArrowToolbarButton(); // exit sparrow mode
    xyTile.getLayerDeleteButton().eq(1).click(); // Clean up graph
    xyTile.getLayerDeleteButton().eq(0).click();

    cy.log("Annotation buttons for movable line");
    xyTile.getTile().click();
    clueCanvas.clickToolbarButton('graph', 'movable-line');
    aa.clickArrowToolbarButton(); // sparrow mode
    aa.getAnnotationButtons().should("have.length", 12); // 9 for the table + 3 for movable line
    aa.getAnnotationButtons().eq(0).click(); // Connect handles
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);

    aa.getAnnotationDeleteButtons().eq(0).click(); // Remove arrow
    aa.getAnnotationButtons().eq(2).click(); // Connect equation to table
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("Can add annotations to chip simulator tile", () => {
    beforeTest(queryParamsQa);
    clueCanvas.addTile("simulator");
    simulatorTile.getSimulatorTile().should("exist");

    clueCanvas.addTile("dataflow");
    dataflowTile.getDataflowTile().should("exist");

    // with no program, sim tile should have 28 "pin" buttons.
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 28);

    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(27).click();
    aa.getAnnotationArrows().should("have.length", 1);

    aa.clickArrowToolbarButton();
    // Create input, processing, and output nodes
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getCreateNodeButton("math").click();
    dataflowTile.getCreateNodeButton("demo-output").click();

    aa.clickArrowToolbarButton();
    // The 3 nodes create annotation buttons in the dataflow tile and mini nodes
    // in the simulation tile
    aa.getAnnotationButtons().should("have.length", 28+2*3);
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(2).click();
    aa.getAnnotationArrows().should("have.length", 2);

  });

  it("Can add annotations to the dataflow tile", () => {
    const url = "/editor/?appMode=qa&unit=./demo/units/qa-config-subtabs/content.json&mouseSensor";
    cy.visit(url);

    clueCanvas.addTile("dataflow");
    dataflowTile.getDataflowTile().should("exist");

    // Create input, processing, and output nodes
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getCreateNodeButton("math").click();
    dataflowTile.getCreateNodeButton("demo-output").click();

    cy.log("There should be an annotation button for each node");
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 4);

    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(2).click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.clickArrowToolbarButton();

    cy.log("The annotation arrow should continue showing when recording");
    dataflowTile.getRecordButton().click();
    // This ought to wait until the first tick happens which will update the timer
    dataflowTile.getCountdownTimer({timeout: 3000}).should("contain", "00:01");
    aa.getAnnotationArrows().should("have.length", 1);
    dataflowTile.getStopButton().click();

    cy.log("The annotation arrow should continue showing when stopped");
    dataflowTile.getPlayButton().should("be.enabled");
    // Briefly wait to make sure the recorded program blocks are now showing
    cy.wait(100);
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("New annotations can be made on a recorded program");
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 4);
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationArrows().should("have.length", 2);
    aa.clickArrowToolbarButton();

    cy.log("Annotations continue showing after clearing the recording");
    dataflowTile.getRecordingClearButton().click();
    dataflowTile.getClearDataWarningClear().click();
    dataflowTile.getSamplingRateLabel().should("have.text", "Sampling Rate");
    aa.getAnnotationArrows().should("have.length", 2);
  });
});
