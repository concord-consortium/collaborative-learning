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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("have.length", 3);

    cy.log("Pressing a tile button exits sparrow mode");
    clueCanvas.addTile("drawing");
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.getAnnotationModeButton().click();

    cy.log("Pressing select button exits sparrow mode");
    aa.getAnnotationLayer().should("have.class", "editing");
    clueCanvas.getSelectTool().click();
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.getAnnotationModeButton().click();

    cy.log("Double-clicking background exits sparrow mode");
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationLayer().dblclick();
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.getAnnotationModeButton().click();

    cy.log("ESC key exits sparrow mode");
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationLayer().type("{esc}");
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.getAnnotationModeButton().click();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationModeButton().type("{esc}");
    aa.getAnnotationLayer().should("not.have.class", "editing");
    aa.getAnnotationModeButton().click();

    cy.log("Annotation mode can switch between curved and straight arrows");
    aa.getAnnotationModeButton().should("have.attr", "title", "Sparrow: curved");
    aa.getCurvedArrowToolbarButton().should("not.exist");
    aa.getStraightArrowToolbarButton().should("not.exist");
    aa.getAnnotationMenuExpander().click();
    aa.getCurvedArrowToolbarButton().should("exist").and("have.class", "active");
    aa.getStraightArrowToolbarButton().should("exist").and("not.have.class", "active");

    aa.getStraightArrowToolbarButton().click(); // select straight arrows and close menu
    aa.getAnnotationModeButton().should("have.attr", "title", "Sparrow: straight");
    aa.getCurvedArrowToolbarButton().should("not.exist");
    aa.getStraightArrowToolbarButton().should("not.exist");
    // long-press should also open menu
    aa.getAnnotationModeButton().trigger("mousedown");
    cy.wait(600);
    aa.getAnnotationModeButton().trigger("mouseup");
    aa.getCurvedArrowToolbarButton().should("exist").and("not.have.class", "active");
    aa.getStraightArrowToolbarButton().should("exist").and("have.class", "active");
    aa.getCurvedArrowToolbarButton().click();
    aa.getAnnotationModeButton().should("have.attr", "title", "Sparrow: curved");
    aa.getCurvedArrowToolbarButton().should("not.exist");
    aa.getStraightArrowToolbarButton().should("not.exist");

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

    // Short click on the "drag handle" of existing sparrow can create a new sparrow
    aa.getAnnotationArrowDragHandles().should('have.length', 4);
    aa.getAnnotationArrowDragHandles().eq(0).trigger('mousedown', { force: true });
    aa.getAnnotationArrowDragHandles().eq(0).trigger('mouseup', { force: true });
    aa.getPreviewArrow().should("exist");
    aa.getAnnotationButtons().eq(2).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 3);
    aa.getPreviewArrow().should("not.exist");
    aa.getAnnotationDeleteButtons().eq(2).click();

    cy.log("Can annotate grouped objects");
    aa.getAnnotationArrows().should("have.length", 2);
    aa.getAnnotationButtons().should("have.length", 3);
    // Group the two rectangles
    aa.getAnnotationModeButton().click(); // sparrow mode off
    drawToolTile.getRectangleDrawing().eq(0).click();
    drawToolTile.getRectangleDrawing().eq(1).click({ shiftKey: true });
    clueCanvas.clickToolbarButton('drawing', 'group');
    aa.getAnnotationModeButton().click(); // sparrow mode on
    aa.getAnnotationArrows().should("have.length", 2); // doesn't change number of arrows
    aa.getAnnotationButtons().should("have.length", 3); // doesn't change number of buttons
    // Ungroup the two rectangles
    aa.getAnnotationModeButton().click(); // sparrow mode off
    drawToolTile.getDrawTile().click();
    drawToolTile.getGroupDrawing().eq(0).find("rect.group-rect").eq(0).click();
    clueCanvas.clickToolbarButton('drawing', 'ungroup');
    aa.getAnnotationModeButton().click(); // sparrow mode on

    // Long click or drag, however, does not create a new sparrow.
    aa.getAnnotationArrowDragHandles().eq(3).trigger('mousedown', { force: true });
    cy.wait(500);
    aa.getAnnotationArrowDragHandles().eq(3).trigger('mouseup', { force: true });
    aa.getPreviewArrow().should("not.exist");

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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationTextInputs().should("not.exist");
    aa.getAnnotationTextDisplays().first().should("have.css", "pointer-events", "none");
    aa.getAnnotationTextInputs().should("not.exist");
    aa.getAnnotationModeButton().click();
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
    aa.getAnnotationModeButton().click();
    aa.clickHideAnnotationsButton();
    aa.getAnnotationLayer().should("not.be.visible");

    cy.log("Arrows become visible when you enter sparrow mode");
    aa.getAnnotationModeButton().click();
    aa.getAnnotationLayer().should("be.visible");

    cy.log("Arrows persist on reload");
    aa.getAnnotationArrows().should("exist");
    cy.reload();
    aa.getAnnotationArrows().should("exist");

    aa.getAnnotationModeButton().click();
    aa.getAnnotationDeleteButtons().eq(0).click({force: true});
    aa.getAnnotationArrows().should("have.length", 0);

    cy.log("Can create straight arrow annotations");
    aa.getAnnotationMenuExpander().click();
    aa.getStraightArrowToolbarButton().click();
    aa.getAnnotationButtons().eq(0).click(); // First end is anchored to an object
    aa.getAnnotationSvg().click(200, 190);
    aa.getAnnotationArrows().should("have.length", 1);

    aa.getAnnotationSvg().click(500, 100);
    aa.getAnnotationButtons().eq(1).click(); // Second end is anchored to an object
    aa.getAnnotationArrows().should("have.length", 2);
    aa.getAnnotationDeleteButtons().eq(0).click();
    aa.getAnnotationDeleteButtons().eq(0).click();

    aa.getAnnotationSvg().click(200, 300); // Both ends free should not create an arrow
    aa.getAnnotationSvg().click(300, 100);
    aa.getAnnotationArrows().should("have.length", 0);

    // Attempting to connect both ends to objects results in second end being free
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(0).click(); // Just the click location is used.
    aa.getAnnotationModeButton().click(); // exit sparrow mode
    aa.getAnnotationArrows().should("have.length", 1);
    drawToolTile.getEllipseDrawing().find("ellipse").click({ force: true, scrollBehavior: false });
    // FIXME the force here is because the "delete" button is off screen -- the toolbar is too wide.
    // We should probably address the root of this problem rather than forcing in the test,
    // but doing this to get things in a state that builds for now.
    clueCanvas.clickToolbarButton('drawing', 'delete', { force: true }); // delete the object under the second end; arrow should remain since it was not attached.
    aa.getAnnotationArrows().should("have.length", 1);
    drawToolTile.getRectangleDrawing().eq(0).click({ force: true, scrollBehavior: false });
    clueCanvas.clickToolbarButton('drawing', 'delete', { force: true }); // delete the object under the first end; arrow should be deleted.
    aa.getAnnotationArrows().should("have.length", 0);

    // put the two deleted objects back
    drawToolTile.drawRectangle(50, 50);
    drawToolTile.drawEllipse(200, 50);

    aa.getAnnotationMenuExpander().click();
    aa.getCurvedArrowToolbarButton().click();
    clueCanvas.getSelectTool().click();

    cy.log("Can create sparrows across two tiles");
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTile().should("have.length", 2);
    drawToolTile.drawVector(100, 50, 50, 100);
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 4);
    aa.getAnnotationButtons().first().click({ force: true });
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Can delete sparrows");
    aa.getAnnotationDeleteButtons().eq(0).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 0);
  });

  it("can add arrows to table tiles", () => {
    beforeTest(queryParams);
    clueCanvas.addTile("table");

    cy.log("Annotation buttons only appear for actual cells");
    aa.getAnnotationModeButton().click();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");
    aa.getAnnotationModeButton().click();
    tableToolTile.typeInTableCell(1, '3');
    tableToolTile.typeInTableCell(2, '2');
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 2);

    cy.log("Can create an annotation arrow between two cells");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Can duplicate annotations contained within one tile");
    aa.getAnnotationModeButton().click();
    tableToolTile.getTableTile().click();
    clueCanvas.getDuplicateTool().click();
    aa.getAnnotationModeButton().click(); // To force a rerender of the annotation layer
    aa.getAnnotationModeButton().click();
    aa.getAnnotationArrows().should("have.length", 2);

    cy.log("Can duplicate annotations that span multiple tiles");
    aa.getAnnotationModeButton().click();
    // Delete the copied sparrow so only the original remains
    aa.getAnnotationDeleteButtons().eq(1).click();
    // Create a sparrow between the two tables
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationButtons().eq(1).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 2);
    aa.getAnnotationModeButton().click();
    // Copy the original table. This has one internal sparrow and one sparrow shared with the other tile.
    tableToolTile.getTableCell().eq(0).click();
    clueCanvas.getDuplicateTool().click();
    aa.getAnnotationModeButton().click(); // To force a rerender of the annotation layer
    aa.getAnnotationModeButton().click();
    // Both sparrows should have been copied.
    aa.getAnnotationArrows().should("have.length", 4);
  });

  it("can add arrows to geometry tiles", { scrollBehavior: 'nearest'}, () => {
    beforeTest(queryParams);
    clueCanvas.addTile("geometry");

    cy.log("Annotation buttons appear for points, polygons, and segments");
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    aa.getAnnotationModeButton().click(); // sparrow mode on
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");

    aa.getAnnotationModeButton().click(); // sparrow mode off
    geometryToolTile.getGeometryTile().click(); // select tile
    geometryToolTile.clickGraphPosition(10, 5);
    geometryToolTile.clickGraphPosition(15, 10);
    geometryToolTile.clickGraphPosition(20, 5);
    geometryToolTile.clickGraphPosition(10, 5); // close polygon

    aa.getAnnotationModeButton().click(); // sparrow mode on
    // 3 points + 3 segments + 1 polygon = 7
    aa.getAnnotationButtons().should("have.length", 7);

    cy.log("Can add an arrow to geometry objects");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(6).click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.getAnnotationDeleteButtons().eq(0).click();

    // Remove all the points and polygons
    aa.getAnnotationModeButton().click(); // sparrow mode off
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
    aa.getAnnotationModeButton().click(); // sparrow mode on
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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");
    // Disable the annotation tool again so there isn't a layer on top
    // of the numberline tile
    aa.getAnnotationModeButton().click();

    cy.log("add points so we can add annotations");
    // Click on tile to get the tool bar to show up
    numberlineToolTile.getNumberlineTile().click();
    // Switch to point adding mode
    numberlineToolTile.setToolbarPoint();
    numberlineToolTile.addPointOnNumberlineTick(-4.0);
    numberlineToolTile.addPointOnNumberlineTick(2.0);
    aa.getAnnotationModeButton().click();

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
    aa.getAnnotationModeButton().click();
    // Table cells should have buttons, but there are no dots until the xy plot is connected to the table's dataset
    aa.getAnnotationButtons().should("have.length", 9);
    aa.getAnnotationModeButton().click();
    xyTile.getTile().click();
    clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
    xyTile.linkTable("Table Data 1");
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 12);

    cy.log("Can add an arrow to xy plot dots");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Dots are considered different objects when the axes change");
    aa.getAnnotationModeButton().click();
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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 12);
    aa.getAnnotationModeButton().click();

    xyTile.selectXVariable(varName);
    xyTile.selectYVariable(varName);
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 13);
    aa.getAnnotationModeButton().click();

    cy.log("Can add an arrow to variable dots");
    xyTile.getTile().click();
    aa.getAnnotationModeButton().click();
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.getAnnotationDeleteButtons().eq(0).click(); // Remove arrow
    aa.getAnnotationArrows().should("have.length", 0);
    aa.getAnnotationModeButton().click(); // exit sparrow mode
    xyTile.getLayerDeleteButton().eq(1).click(); // Clean up graph
    xyTile.getLayerDeleteButton().eq(0).click();

    cy.log("Annotation buttons for movable line");
    xyTile.getTile().click();
    clueCanvas.clickToolbarButton('graph', 'movable-line');
    aa.getAnnotationModeButton().click(); // sparrow mode
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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 28);

    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(27).click();
    aa.getAnnotationArrows().should("have.length", 1);

    aa.getAnnotationModeButton().click();
    // Create input, processing, and output nodes
    dataflowTile.getCreateNodeButton("number").click();
    dataflowTile.getCreateNodeButton("math").click();
    dataflowTile.getCreateNodeButton("demo-output").click();

    aa.getAnnotationModeButton().click();
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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 4);

    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationButtons().eq(2).click();
    aa.getAnnotationArrows().should("have.length", 1);
    aa.getAnnotationModeButton().click();

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
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 4);
    aa.getAnnotationButtons().eq(1).click({ force: true });
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationArrows().should("have.length", 2);
    aa.getAnnotationModeButton().click();

    cy.log("Annotations continue showing after clearing the recording");
    dataflowTile.getRecordingClearButton().click();
    dataflowTile.getClearDataWarningClear().click();
    dataflowTile.getSamplingRateLabel().should("have.text", "Sampling Rate");
    aa.getAnnotationArrows().should("have.length", 2);
  });

  it("Can add annotations to tiles nested within a question tile", () => {
    const qTileParams = `${Cypress.config("qaUnitStudent5")}`;
    cy.visit(qTileParams);
    cy.waitForLoad();

    cy.log("Add a question tile with a nested drawing tile");
    clueCanvas.addTile('question');
    clueCanvas.addTileByDrag('drawing', 'top');
    drawToolTile.drawRectangle(50, 50);
    drawToolTile.drawEllipse(200, 50);

    cy.log("Add another drawing tile outside the question tile");
    clueCanvas.addTile('drawing');
    drawToolTile.drawRectangle(50, 50);
    drawToolTile.drawEllipse(200, 50);

    cy.log("Create annotation from drawing tile nested within the question tile to the other drawing tile");
    aa.getAnnotationModeButton().click();
    aa.getAnnotationButtons().should("have.length", 4);
    aa.getAnnotationButtons().first().click({ force: true });
    aa.getAnnotationButtons().eq(3).click();
    aa.getAnnotationArrows().should("have.length", 1);

    cy.log("Create annotation from outer drawing tile to the drawing tile inside question tile");
    aa.getAnnotationButtons().eq(2).click();
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationArrows().should("have.length", 2);

    cy.log("Create annotation between objects in nested drawing tile");
    aa.getAnnotationButtons().first().click({ force: true });
    aa.getAnnotationButtons().eq(1).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 3);
  });
});
