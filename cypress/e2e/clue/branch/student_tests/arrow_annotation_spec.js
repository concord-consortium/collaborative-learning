import ArrowAnnotation from '../../../../support/elements/clue/ArrowAnnotation';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import NumberlineToolTile from '../../../../support/elements/clue/NumberlineToolTile';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';
import XYPlotToolTile from '../../../../support/elements/clue/XYPlotToolTile';

const aa = new ArrowAnnotation;
const clueCanvas = new ClueCanvas;
const drawToolTile = new DrawToolTile;
const tableToolTile = new TableToolTile;
const graphToolTile = new GraphToolTile;
const numberlineToolTile = new NumberlineToolTile;
const xyTile = new XYPlotToolTile;

const queryParams = {
  unit1:"?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example",
  unit2:"?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=dfe",
  unit3:"?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=example-config-subtabs"
};

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
    beforeTest(queryParams.unit1);
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTile().should("exist");
    drawToolTile.getTileTitle().should("exist");

    cy.log("Add a rectangle");
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("mousedown", 150, 50)
      .trigger("mousemove", 100, 150)
      .trigger("mouseup", 100, 50);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);

    cy.log("Add an ellipse");
    drawToolTile.getDrawToolEllipse().click();
    drawToolTile.getDrawTile()
      .trigger("mousedown", 250, 50)
      .trigger("mousemove", 200, 100)
      .trigger("mouseup", 200, 100);
    drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);

    cy.log("Annotation buttons only appear in sparrow mode");
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("have.length", 2);

    cy.log("Pressing a tile button exits sparrow mode");
    clueCanvas.addTile("drawing");
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
    drawToolTile.getDrawToolVector().eq(1).click();
    drawToolTile.getDrawTile().eq(1)
      .trigger("mousedown", 150, 50)
      .trigger("mousemove", 100, 150)
      .trigger("mouseup", 100, 50);
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 3);
    aa.getAnnotationButtons().first().click({ force: true });
    aa.getAnnotationButtons().eq(2).click();
    aa.getAnnotationArrows().should("have.length", 2);

    cy.log("Can delete sparrows");
    aa.getAnnotationDeleteButtons().eq(1).click({ force: true });
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("can add arrows to table tiles", () => {
    beforeTest(queryParams.unit1);
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

  it("can add arrows to geometry tiles", () => {
    beforeTest(queryParams.unit3);
    clueCanvas.addTile("geometry");

    cy.log("Annotation buttons appear for points, polygons, and segments");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    // For some reason adding the first point is ignored, so we add four but get three to make a triangle
    graphToolTile.addPointToGraph(5, 5);
    graphToolTile.addPointToGraph(10, 5);
    graphToolTile.addPointToGraph(15, 10);
    graphToolTile.addPointToGraph(20, 5);
    graphToolTile.getGraphPoint().last().dblclick({ force: true });
    aa.clickArrowToolbarButton();
    // 3 points + 3 segments + 1 polygon = 7
    aa.getAnnotationButtons().should("have.length", 7);

    cy.log("Can add an arrow to geometry objects");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(6).click();
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("can add arrows to numberline tiles", () => {
    beforeTest(queryParams.unit1);
    clueCanvas.addTile("numberline");

    cy.log("Annotation buttons appear for points");
    aa.clickArrowToolbarButton();
    aa.getAnnotationLayer().should("have.class", "editing");
    aa.getAnnotationButtons().should("not.exist");
    aa.clickArrowToolbarButton();
    numberlineToolTile.addPointOnNumberlineTick(-4);
    numberlineToolTile.addPointOnNumberlineTick(2);
    aa.clickArrowToolbarButton();
    aa.getAnnotationButtons().should("have.length", 2);

    cy.log("Can add an arrow to numberline points");
    aa.getAnnotationArrows().should("not.exist");
    aa.getAnnotationButtons().eq(1).click();
    aa.getAnnotationButtons().eq(0).click();
    aa.getAnnotationArrows().should("have.length", 1);
  });

  it("can add arrows to xy plot tiles", () => {
    beforeTest(queryParams.unit1);
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
    xyTile.getLinkTileButton().click();
    xyTile.linkTable("Table 1");
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
  });
});
