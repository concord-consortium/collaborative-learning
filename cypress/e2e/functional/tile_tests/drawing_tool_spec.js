import ClueCanvas from '../../../support/elements/common/cCanvas';
import DrawToolTile from '../../../support/elements/tile/DrawToolTile';
import ImageToolTile from '../../../support/elements/tile/ImageToolTile';
import { LogEventName } from '../../../../src/lib/logger-types';
import { parseTransform } from '../../../support/helpers/transform';

const clueCanvas = new ClueCanvas;
const drawToolTile = new DrawToolTile;
const imageToolTile = new ImageToolTile;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

// NOTE: For some reason cypress+chrome thinks that the SVG elements are in a
// scrollable container. Because of this when cypress does an action on a SVG
// element like click or trigger, by default it tries to scroll this element to
// the top of the containers visible area. Likewise when looking at the test
// results after a run is complete the cypress app will automatically scroll
// this area when you select a cypress `get` that is selecting a SVG element.
//
// - The first issue is addressed here by adding `scrollBehavior: false` to each
//   action that works with an SVG element, or to the whole test (suite).
// - The second issue has no simple solution, so you need to remember it when
//   looking at the results.
// - The best solution to both problems would be to figure out the CSS necessary
//   so cypress+chrome simply cannot scroll the container.

context('Draw Tool Tile', function () {
  it("renders draw tool tile and supports freehand tool", () => {
    beforeTest();

    cy.window().then(win => {
      cy.stub(win.ccLogger, "log").as("log");
    });
    cy.get("@log").should('not.have.been.called');
    clueCanvas.addTile("drawing");
    cy.get("@log")
      .should("have.been.been.calledWith", LogEventName.CREATE_TILE, Cypress.sinon.match.object)
      .its("firstCall.args.1").should("deep.include", { objectType: "Drawing" });

    drawToolTile.getDrawTile().should("exist");
    drawToolTile.getTileTitle().should("exist");
    clueCanvas.toolbarButtonIsDisabled("drawing", "fit-all");

    cy.log("can open show/sort panel and select objects");
    drawToolTile.drawRectangle(100, 50, 150, 100);
    drawToolTile.drawEllipse(300, 50, 100, 100);
    clueCanvas.toolbarButtonIsEnabled("drawing", "fit-all");
    // Unselect all
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 50, 50, { isPrimary: true })
      .trigger("pointerup", 50, 50, { isPrimary: true });
    drawToolTile.getSelectionBox().should("not.exist");

    // Open panel
    drawToolTile.getDrawTileShowSortPanelOpenButton().click({ scrollBehavior: false });
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open").and("contain.text", "Rectangle").and("contain.text", "Circle");
    // Click to select
    drawToolTile.getDrawTileShowSortPanel().find('li:first').should("contain.text", "Circle").click({ scrollBehavior: false });
    drawToolTile.getSelectionBox().should("exist");

    cy.log("can hide and show objects");
    drawToolTile.getEllipseDrawing().should("exist");
    // Click 'hide' button - unselects ellipse and makes it invisible
    drawToolTile.getDrawTileShowSortPanel().find('li:first button.visibility-icon').click();
    drawToolTile.getEllipseDrawing().should("not.exist");
    drawToolTile.getSelectionBox().should("not.exist");
    // Now select it - should show as a faint 'ghost'
    drawToolTile.getDrawTileShowSortPanel().find('li:first').click();
    drawToolTile.getSelectionBox().should("exist");
    drawToolTile.getGhostGroup().should("exist").find('ellipse').should("exist");
    // Make visible again
    drawToolTile.getDrawTileShowSortPanel().find('li:first button.visibility-icon').click();
    drawToolTile.getEllipseDrawing().should("exist");
    drawToolTile.getGhostGroup().should("not.exist");

    cy.log("can re-order objects");
    // Test via keyboard since dragging is harder
    drawToolTile.getDrawTileShowSortPanel().find('li:first').should("contain.text", "Circle");
    drawToolTile.getDrawTileShowSortPanel().find('li:last').should("contain.text", "Rectangle");
    drawToolTile.getDrawTileShowSortPanel().find('li:first svg.move-icon').focus().type(' {downArrow}{enter}');
    drawToolTile.getDrawTileShowSortPanel().find('li:first').should("contain.text", "Rectangle");
    drawToolTile.getDrawTileShowSortPanel().find('li:last').should("contain.text", "Circle");

    cy.log("can zoom in, zoom out, and fit objects");
    drawToolTile.getDrawTileObjectCanvas().should('have.attr', 'transform', 'translate(0, 0) scale(1)');
    clueCanvas.clickToolbarButton('drawing', 'zoom-in');
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: -58, y: -8 };
      const expectedScale = 1.1;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });
    cy.get("@log")
      .should("have.been.been.calledWith", LogEventName.DRAWING_TOOL_CHANGE, Cypress.sinon.match.object)
      .its("lastCall.args.1").should("deep.include", { operation: "setZoom", args: [1.1, { x: 1168, y: 176 } ] });

    clueCanvas.clickToolbarButton('drawing', 'zoom-out');
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: 0, y: 0 };
      const expectedScale = 1;
      const nearZeroTolerance = 1e-10;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale, nearZeroTolerance);
    });
    cy.get("@log")
      .should("have.been.been.calledWith", LogEventName.DRAWING_TOOL_CHANGE, Cypress.sinon.match.object)
      .its("lastCall.args.1").should("deep.include", { operation: "setZoom", args: [1, { x: 1168, y: 176 }] });

    // Should not zoom out past zoom level .1
    for (let z=0; z< 9; z++) {
      clueCanvas.clickToolbarButton('drawing', 'zoom-out');
    }
    clueCanvas.toolbarButtonIsDisabled('drawing', 'zoom-out');
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: 526, y: 79 };
      const expectedScale = 0.1;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });

    // Should not zoom in past zoom level 2
    for (let z=0; z< 19; z++) {
      clueCanvas.clickToolbarButton('drawing', 'zoom-in');
    }
    clueCanvas.toolbarButtonIsDisabled('drawing', 'zoom-in');
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: -585, y: -88 };
      const expectedScale = 2;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });

    // Fit should return an appropriate zoom level for the objects drawn
    clueCanvas.clickToolbarButton('drawing', 'fit-all');
    clueCanvas.toolbarButtonIsEnabled('drawing', 'zoom-in');
    clueCanvas.toolbarButtonIsEnabled('drawing', 'zoom-out');
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      // Check that the canvas has a transform attribute like 'scale(x)' where x is approximatesly .83
      const scale = parseFloat(canvas.attr('transform').replace(/.*scale\((\d+\.\d+)\)/, '$1'));
      expect(scale).to.be.within(.82, .84);
    });

    cy.log("can delete objects and close panel");
    // Reset zoom to 100%
    clueCanvas.clickToolbarButton('drawing', 'zoom-in');
    clueCanvas.clickToolbarButton('drawing', 'zoom-in');
    // Delete objects
    drawToolTile.getDrawTileShowSortPanel().find('li:first').should("contain.text", "Rectangle").click();
    drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click();
    drawToolTile.getDrawTileShowSortPanel().find('li').should("have.length", 1);
    drawToolTile.getDrawTileShowSortPanel().find('li:first').should("contain.text", "Circle").click();
    drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click();
    drawToolTile.getDrawTileShowSortPanel().find('li').should("not.exist");
    // Close panel
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "closed");

    cy.log("verify draw a freehand line");
    drawToolTile.getDrawToolFreehand().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 350, 50, { isPrimary: true })
      .trigger("pointermove", 350, 100, { isPrimary: true })
      .trigger("pointermove", 450, 100, { isPrimary: true })
      .trigger("pointerup", 450, 100, { isPrimary: true });
    drawToolTile.getFreehandDrawing().should("exist").and("have.length", 1);
    // Freehand tool should still be active
    drawToolTile.getDrawToolFreehand().should("have.class", "selected");

    cy.log("shows up in show/sort panel");
    drawToolTile.getDrawTileShowSortPanelOpenButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open")
      .find("li").should("have.length", 1).and("contain.text", "Freehand");
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();

    cy.log("selects freehand drawing");
    drawToolTile.getDrawToolSelect().click();
    // First make sure we don't select it even if we are inside of its
    // bounding box
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 370, 50, { isPrimary: true })
      .trigger("pointermove", 450, 80, { isPrimary: true })
      .trigger("pointerup", 450, 80, { isPrimary: true });
    drawToolTile.getDrawToolDelete().should("have.class", "disabled");

    drawToolTile.getDrawTile()
      .trigger("pointerdown", 340, 90, { isPrimary: true })
      .trigger("pointermove", 360, 110, { isPrimary: true })
      .trigger("pointerup", 360, 110, { isPrimary: true });
    drawToolTile.getDrawToolDelete().should("not.have.class", "disabled");

    cy.log("verify change outline color");
    drawToolTile.getDrawToolStrokeColor().click();
    cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").eq(1).click();
    drawToolTile.getFreehandDrawing().first().find("path").should("have.attr", "stroke").and("eq", "#eb0000");

    cy.log("verify change fill color");
    drawToolTile.getFreehandDrawing().first().find("path").should("not.have.attr", "fill-color");
    drawToolTile.getDrawToolFillColor().click();
    cy.get(".toolbar-palette.fill-color .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.fill-color .palette-buttons .color-swatch").last().click();
    drawToolTile.getFreehandDrawing().first().find("path").should("have.attr", "fill").and("eq", "#d100d1");

    cy.log("deletes freehand drawing");
    // Without the previous test this is how to select it, using the simple click
    // approach doesn't seem to work well with paths, the location that cypress clicks
    // is not on the path
    // drawToolTile.getDrawToolSelect().click();
    // drawToolTile.getDrawTile()
    //   .trigger("pointerdown", 350, 100)
    //   .trigger("pointerup", 350, 100);
    drawToolTile.getSelectionBox().should("exist");
    drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click();
    drawToolTile.getFreehandDrawing().should("not.exist");

    cy.log("verify Draw tile restore upon page reload");
    const newName = "Drawing Tile";
    drawToolTile.getTileTitle().first().should("contain", "Sketch 1");
    drawToolTile.getDrawTileTitle().first().click();
    drawToolTile.getDrawTileTitle().first().type(newName + '{enter}');
    drawToolTile.getTileTitle().should("contain", newName);

    drawToolTile.drawRectangle(250, 50, -150, 100);

    cy.log("verify Draw tile restore upon page reload");
    cy.wait(2000);
    cy.reload();
    cy.waitForLoad();

    drawToolTile.getTileTitle().should("contain", newName);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
  });

  it("Vector", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("verify draw vector");
    drawToolTile.drawVector(250, 50, -150, 0);
    drawToolTile.getVectorDrawing().should("exist").and("have.length", 1);
    // Select tool should be selected after object created
    drawToolTile.getDrawToolSelect().should("have.class", "selected");

    cy.log("shows up in show/sort panel");
    drawToolTile.getDrawTileShowSortPanelOpenButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open")
      .find("li").should("have.length", 1).and("contain.text", "Line");
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();

    cy.log("verify after creation, object is selected");
    drawToolTile.getDrawToolSelect().should("have.class", "selected");
    drawToolTile.getDrawToolVector().should("not.have.class", "selected");
    drawToolTile.getSelectionBox().should("exist");
    drawToolTile.getDrawToolDelete().should("not.have.class", "disabled");

    cy.log("verify change outline color");
    drawToolTile.getDrawToolStrokeColor().click();
    cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").eq(2).click();
    drawToolTile.getVectorDrawing().first().find("g.vector").should("have.attr", "stroke").and("eq", "#008a00");
    drawToolTile.getDrawToolStrokeColor().click();
    cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").first().click();

    cy.log("change line to arrow");
    drawToolTile.getVectorDrawing().first().find("line").its("length").should("eq", 1); // Only a line
    drawToolTile.getVectorDrawing().first().find("polygon").should("not.exist"); // No arrowheads yet
    drawToolTile.getDrawToolVectorSubmenu().click();
    cy.get(".toolbar-palette.vectors .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.vectors .palette-buttons div:nth-child(3) button").click();
    drawToolTile.getVectorDrawing().first().find("line").its("length").should("eq", 1); // Line is still there
    drawToolTile.getVectorDrawing().first().find("polygon").its("length").should("eq", 2); // plus two arrowheads.
    // selecting from this submenu activates the vector tool, which de-selects the object.

    cy.log("deletes vector drawing");
    // re-select the object using a selection rectangle.
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 90, 40, { isPrimary: true })
      .trigger("pointermove", 260, 60, { isPrimary: true })
      .trigger("pointerup", 260, 60, { isPrimary: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getVectorDrawing().should("not.exist");

    cy.log("draws vector constrained to horizontal or vertical");
    drawToolTile.getDrawToolVector().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 100, { shiftKey: true, isPrimary: true })
      .trigger("pointermove", 200, 110, { shiftKey: true, isPrimary: true }) // Y value is different, but should be constrained to horizontal
      .trigger("pointerup",   200, 110, { shiftKey: true, isPrimary: true });
    drawToolTile.getVectorDrawing().should("exist").and("have.length", 1);
    drawToolTile.getVectorDrawing().find("line").invoke('attr', 'y1')
      .then(y1 => {
        drawToolTile.getVectorDrawing().find("line").invoke('attr', 'y2')
        .should('eq', y1);
      });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getVectorDrawing().should("not.exist");

    // Same for vertical vector
    drawToolTile.getDrawToolVector().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 25, { shiftKey: true, isPrimary: true })
      .trigger("pointermove", 110, 125, { shiftKey: true, isPrimary: true }) // X value is different, but should be constrained to vertical
      .trigger("pointerup",   110, 125, { shiftKey: true, isPrimary: true });
    drawToolTile.getVectorDrawing().should("exist").and("have.length", 1);
    drawToolTile.getVectorDrawing().find("line").invoke('attr', 'x1')
      .then(x1 => {
        drawToolTile.getVectorDrawing().find("line").invoke('attr', 'x2')
        .should('eq', x1);
      });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getVectorDrawing().should("not.exist");
  });

  it("Rectangle", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("verify draw rectangle");
    drawToolTile.drawRectangle(250, 50, -150, 100);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
    // Select tool should be selected after object created
    drawToolTile.getDrawToolSelect().should("have.class", "selected");

    cy.log("shows up in show/sort panel");
    drawToolTile.getDrawTileShowSortPanelOpenButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open")
      .find("li").should("have.length", 1).and("contain.text", "Rectangle");
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();

    cy.log("verify change outline color");
    drawToolTile.getRectangleDrawing().first().find("rect").should("have.attr", "stroke").and("eq", "#000000");
    drawToolTile.getDrawToolStrokeColor().click();
    cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").last().click();
    drawToolTile.getRectangleDrawing().first().find("rect").should("have.attr", "stroke").and("eq", "#d100d1");

    cy.log("verify change fill color");
    drawToolTile.getRectangleDrawing().first().find("rect").should("not.have.attr", "fill-color");
    // The rectangle is already selected, so we don't need to select it again
    drawToolTile.getDrawToolFillColor().click();
    cy.get(".toolbar-palette.fill-color .palette-buttons").should("be.visible");
    cy.get(".toolbar-palette.fill-color .palette-buttons .color-swatch").last().click();
    drawToolTile.getRectangleDrawing().first().find("rect").should("have.attr", "fill").and("eq", "#d100d1");

    cy.log("verify moving pre-selected object");
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getRectangleDrawing().first()
    .invoke('attr', 'transform')
    .then(transform => {
      expect(parseTransform(transform, 'translate')[0]).to.be.within(210, 230);
      expect(parseTransform(transform, 'rotate')).to.deep.equal([0]);
      expect(parseTransform(transform, 'translate', 1)).to.deep.equal([-150, -100]);
      expect(parseTransform(transform, 'scale')).to.deep.equal([1, 1]);
    });
    // Drag right 100 px
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 100, { isPrimary: true })
      .trigger("pointermove", 200, 100, { isPrimary: true })
      .trigger("pointerup", 200, 100, { isPrimary: true });
    // For some reason the move isn't very accurate in cypress so often the final location off
    drawToolTile.getRectangleDrawing().first().should("have.attr", "transform");
    drawToolTile.getRectangleDrawing().first()
      .invoke('attr', 'transform')
      .then(transform => {
        expect(parseTransform(transform, 'translate')[0]).to.be.within(310, 330);
        expect(parseTransform(transform, 'rotate')).to.deep.equal([0]);
        expect(parseTransform(transform, 'translate', 1)).to.deep.equal([-150, -100]);
        expect(parseTransform(transform, 'scale')).to.deep.equal([1, 1]);
    });

    cy.log("verify hovering objects");
    drawToolTile.getDrawTile()
      // Un-select the rectangle
      .trigger("pointerdown", 500, 100, { isPrimary: true })
      .trigger("pointerup", 500, 100, { isPrimary: true });

    drawToolTile.getRectangleDrawing().first()
      // Get the rectangle to be hovered. In the code we are listening to
      // `onMouseEnter` but in Cypress triggering a "mouseenter" event
      // doesn't work. Triggering a "mouseover" does work for some reason.
      .trigger("mouseover");

    // The hover box is rendered as a selection-box with a different color
    drawToolTile.getHighlightBox().should("exist").should("have.attr", "stroke").and("eq", "#bbdd00");

    // The best way I found to remove the hover was to delete the rectangle
    drawToolTile.getRectangleDrawing().first().click({ force: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getHighlightBox().should("not.exist");

    cy.log("verify moving not selected object");
    drawToolTile.drawRectangle(250, 50, -150, 100);
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
    drawToolTile.getSelectionBox().should("exist");

    // Unselect the rectangle just drawn
    drawToolTile.getDrawTile()
      // Un-select the rectangle
      .trigger("pointerdown", 500, 100, { isPrimary: true })
      .trigger("pointerup", 500, 100, { isPrimary: true });
    drawToolTile.getSelectionBox().should("not.exist");

    // Get the rectangle to be hovered, see above for more info.
    drawToolTile.getRectangleDrawing()
      .trigger("mouseover");
    drawToolTile.getHighlightBox().should("exist").should("have.attr", "stroke").and("eq", "#bbdd00");

    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 135, { isPrimary: true })
      .trigger("pointermove", 200, 135, { isPrimary: true })
      .trigger("pointerup", 200, 135, { isPrimary: true });

    drawToolTile.getRectangleDrawing().first()
      .invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(310, 330));

    // The best way I found to remove the hover was to delete the rectangle
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getRectangleDrawing().should("not.exist");
    drawToolTile.getSelectionBox().should("not.exist");
    drawToolTile.getHighlightBox().should("not.exist");

    cy.log("verify draw squares");
    // starting from top edge
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { altKey: true, isPrimary: true })
      .trigger("pointermove", 100, 70, { altKey: true, isPrimary: true })
      .trigger("pointerup", 100, 70, { isPrimary: true });

    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "width").and("eq", "20");
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "height").and("eq", "20");

    // starting from the left edge
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 200, 50, { altKey: true, isPrimary: true })
      .trigger("pointermove", 230, 50, { altKey: true, isPrimary: true })
      .trigger("pointerup", 230, 50, { isPrimary: true });
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 2);
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "width").and("eq", "30");
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "height").and("eq", "30");

    // draw a square starting at the bottom edge
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 300, 90, { altKey: true, isPrimary: true })
      .trigger("pointermove", 300, 50, { altKey: true, isPrimary: true })
      .trigger("pointerup", 300, 50, { isPrimary: true });
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 3);
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "width").and("eq", "40");
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "height").and("eq", "40");

    // draw a square starting at the right edge
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 450, 50, { altKey: true, isPrimary: true })
      .trigger("pointermove", 400, 50, { altKey: true, isPrimary: true })
      .trigger("pointerup", 400, 50, { isPrimary: true });
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 4);
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "width").and("eq", "50");
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "height").and("eq", "50");

    // Diagonal from top right to bottom left with the width 60 and height 50
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 560, 50, { altKey: true, isPrimary: true })
      .trigger("pointermove", 500, 100, { altKey: true, isPrimary: true })
      .trigger("pointerup", 500, 100, { isPrimary: true });
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 5);
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "width").and("eq", "60");
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "height").and("eq", "60");

    // Diagonal from bottom right to top left with the width 50 and the height 70
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 650, 120, { altKey: true, isPrimary: true })
      .trigger("pointermove", 600, 50, { altKey: true, isPrimary: true })
      .trigger("pointerup", 600, 50, { isPrimary: true });
    drawToolTile.getRectangleDrawing().should("exist").and("have.length", 6);
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "width").and("eq", "70");
    drawToolTile.getRectangleDrawing().last().find("rect").should("have.attr", "height").and("eq", "70");

    cy.log("deletes rectangle drawings");
    drawToolTile.getDrawTile().click();
    // delete the first 4 with the toolbar button
    for (let i = 0; i < 4; i++) {
      drawToolTile.getDrawToolSelect().click();
      drawToolTile.getRectangleDrawing().first().click({ force: true });
      drawToolTile.getDrawToolDelete().click();
    }
    // Delete with backspace key
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getRectangleDrawing().first().click({ force: true });
    drawToolTile.getDrawTileComponent().type("{backspace}");

    // Delete with delete key
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getRectangleDrawing().first().click({ force: true });
    drawToolTile.getDrawTileComponent().type("{del}");

    drawToolTile.getRectangleDrawing().should("not.exist");

  });
  it("Ellipse", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("verify draw ellipse");
    drawToolTile.drawEllipse(250, 50, -150, 100);
    drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);
    // Select tool should be selected after object created
    drawToolTile.getDrawToolSelect().should("have.class", "selected");

    cy.log("shows up in show/sort panel");
    drawToolTile.getDrawTileShowSortPanelOpenButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open")
      .find("li").should("have.length", 1).and("contain.text", "Ellipse");
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();

    cy.log("verify draw circle");
    drawToolTile.getDrawToolEllipse().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 450, 50, { altKey: true, isPrimary: true })
      .trigger("pointermove", 450, 150, { altKey: true, isPrimary: true })
      .trigger("pointerup", 450, 150, { isPrimary: true });
    drawToolTile.getEllipseDrawing().should("exist").and("have.length", 2);
    drawToolTile.getEllipseDrawing().last().find("ellipse").should("have.attr", "rx").and("eq", "100");
    drawToolTile.getEllipseDrawing().last().find("ellipse").should("have.attr", "ry").and("eq", "100");

    cy.log("deletes ellipse drawing");
    drawToolTile.getDrawTile().click();
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getEllipseDrawing().first().click({ force: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getEllipseDrawing().first().click({ force: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getEllipseDrawing().should("not.exist");

  });
  it("Stamp", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("verify draw stamp");
    drawToolTile.getDrawToolStamp().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 250, 50, { isPrimary: true })
      .trigger("pointerup", { isPrimary: true });
    drawToolTile.getImageDrawing().should("exist").and("have.length", 1);
    // Stamp tool should still be active
    drawToolTile.getDrawToolStamp().should("have.class", "selected");

    cy.log("shows up in show/sort panel");
    drawToolTile.getDrawTileShowSortPanelOpenButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open")
      .find("li").should("have.length", 1).and("contain.text", "Image");
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();

    cy.log("verify stamp images");
    drawToolTile.getImageDrawing().eq(0).find("image").should("have.attr", "href").and("contain", "plus.png");
    drawToolTile.getDrawToolStampExpand().click();
    cy.get(".toolbar-palette.stamps .palette-buttons .stamp-button").eq(1).click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 250, 100, { isPrimary: true })
      .trigger("pointerup", { isPrimary: true });
    drawToolTile.getImageDrawing().should("exist").and("have.length", 2);
    drawToolTile.getImageDrawing().eq(1).find("image").should("have.attr", "href").and("contain", "equals.png");
    drawToolTile.getDrawToolStampExpand().click();
    cy.get(".toolbar-palette.stamps .palette-buttons .stamp-button").eq(2).click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 250, 150, { isPrimary: true })
      .trigger("pointerup", { isPrimary: true });
    drawToolTile.getImageDrawing().should("exist").and("have.length", 3);
    drawToolTile.getImageDrawing().eq(2).find("image").should("have.attr", "href").and("contain", "lparen.png");

    cy.log("deletes stamp drawing");
    drawToolTile.getDrawToolSelect().click();
    // drawToolTile.getImageDrawing().click({force:true, scrollBehavior: false});
    drawToolTile.getImageDrawing().eq(0).click({ force: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getImageDrawing().eq(1).click({ force: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getImageDrawing().click({ force: true });
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getImageDrawing().should("not.exist");
  });
  it("Text", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("adds text object");
    drawToolTile.getDrawToolText().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 100, { isPrimary: true })
      .trigger("pointerup", 100, 100, { isPrimary: true });
    drawToolTile.getTextDrawing().should("exist").and("have.length", 1);
    // Select tool should be selected after object created
    drawToolTile.getDrawToolSelect().should("have.class", "selected");

    cy.log("shows up in show/sort panel");
    drawToolTile.getDrawTileShowSortPanelOpenButton().click();
    drawToolTile.getDrawTileShowSortPanel().should("have.class", "open")
      .find("li").should("have.length", 1).and("contain.text", "Text");
    drawToolTile.getDrawTileShowSortPanelCloseButton().click();

    cy.log("edits text content of object");
    // Click inside drawing box to enter edit mode
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 150, 150, { isPrimary: true })
      .trigger("pointerup", 150, 150, { isPrimary: true });
    drawToolTile.getTextDrawing().find('textarea').type("The five boxing wizards jump quickly.{enter}");
    drawToolTile.getTextDrawing().find('text tspan').should("exist").and("have.length", 5);

    cy.log("deletes text object");
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 150, 150, { isPrimary: true })
      .trigger("pointerup", 150, 150, { isPrimary: true });
    drawToolTile.getSelectionBox().should("exist");
    drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click();
    drawToolTile.getTextDrawing().should("not.exist");
  });

  it("Group", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("can group and ungroup");
    drawToolTile.drawRectangle(100, 50, 150, 100);
    drawToolTile.drawEllipse(50, 100, 50, 50);
    drawToolTile.drawFreehand([ {x: 150, y: 50}, {x: 200, y: 150} ]);

    // Select all 3 objects
    drawToolTile.dragSelectionRectangle(40, 40, 220, 110);
    drawToolTile.getSelectionBox().should("have.length", 3);

    // Group the 3 objects
    drawToolTile.getDrawToolUngroup().should("have.class", "disabled");
    drawToolTile.getDrawToolGroup().should("not.have.class", "disabled").click();
    drawToolTile.getSelectionBox().should("have.length", 1);
    drawToolTile.getDrawToolGroup().should("have.class", "disabled");
    drawToolTile.getDrawToolUngroup().should("not.have.class", "disabled");

    // --- Nested group test ---
    // Draw a fourth rectangle
    drawToolTile.drawRectangle(300, 100, 50, 50);

    // Select the group and the new rectangle
    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getGroupDrawing().eq(0).click({ force: true });
    // Shift+click the new rectangle to add it to the selection
    drawToolTile.getRectangleDrawing().eq(1).find("rect").click({ force: true, shiftKey: true });

    drawToolTile.getSelectionBox().should("have.length", 2);
    // Group the group and the new rectangle
    drawToolTile.getDrawToolGroup().should("not.have.class", "disabled").click();
    drawToolTile.getSelectionBox().should("have.length", 1);
    drawToolTile.getDrawToolUngroup().should("not.have.class", "disabled");

    // Ungroup the outer group
    drawToolTile.getDrawToolUngroup().click();
    drawToolTile.getSelectionBox().should("have.length", 2);
    // Ungroup again to get back to 4 separate objects
    drawToolTile.getDrawToolUngroup().click();
    drawToolTile.getSelectionBox().should("have.length", 4);
  });

  it("Align objects", { scrollBehavior: false }, () => {
    const
      rectX = 50, // left edge of rectangle in screen coordinates
      rectOffset = 10, // offsets compensate for difference between screen and object coordinates
      freehandX = 110,
      freehandOffset = 0,
      ellipseX = 165,
      ellipseOffset = 60,
      fudgeFactor = 10;

    beforeTest();
    clueCanvas.addTile("drawing");
    clueCanvas.toolbarButtonIsDisabled('drawing', 'align');
    drawToolTile.drawRectangle(rectX, 50, 50, 50);
    drawToolTile.getRectangleDrawing().first()
      .invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(rectX+rectOffset-fudgeFactor, rectX+rectOffset+fudgeFactor));
    drawToolTile.drawFreehand([ {x: freehandX, y: 60}, {x: freehandX+30, y: 50} ]);
    drawToolTile.getFreehandDrawing().first()
      .invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(freehandX+freehandOffset-fudgeFactor, freehandX+freehandOffset+fudgeFactor));
    drawToolTile.drawEllipse(ellipseX+35, 70, 50, 30); // drawing of ellipse starts at its center, not its left edge
    drawToolTile.getEllipseDrawing().first()
      .invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(ellipseX+ellipseOffset-fudgeFactor, ellipseX+ellipseOffset+fudgeFactor));
    clueCanvas.toolbarButtonIsDisabled('drawing', 'align');
    drawToolTile.getRectangleDrawing().eq(0).click();
    drawToolTile.getSelectionBox().should("have.length", 1);
    // Toolbar button remains disabled with one object selected
    clueCanvas.toolbarButtonIsDisabled('drawing', 'align');
    drawToolTile.dragSelectionRectangle(50, 20, 250, 100);
    drawToolTile.getSelectionBox().should("have.length", 3);
    clueCanvas.toolbarButtonIsEnabled('drawing', 'align');
    // Aligns left by default
    clueCanvas.getToolbarButtonToolTipText('drawing', 'align').should("eq", "Align left");
    drawToolTile.getDrawToolAlignOptions().should("not.exist");
    clueCanvas.longClickToolbarButton('drawing', 'align'); // Open palette via long click
    drawToolTile.getDrawToolAlignOptions().should("exist").and("be.visible").and("have.length", 6);
    drawToolTile.getDrawToolAlignOptions().eq(0).click(); // Aligns shapes left and closes palette
    drawToolTile.getDrawToolAlignOptions().should("not.exist");
    clueCanvas.getToolbarButtonToolTipText('drawing', 'align').should("eq", "Align left");
    // All should now have been moved to the location of the rectangle
    drawToolTile.getRectangleDrawing().eq(0).invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(rectX+rectOffset-fudgeFactor, rectX+rectOffset+fudgeFactor));
    drawToolTile.getFreehandDrawing().eq(0).invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(rectX+freehandOffset-fudgeFactor, rectX+freehandOffset+fudgeFactor));
    drawToolTile.getEllipseDrawing().eq(0).invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(rectX+ellipseOffset-fudgeFactor, rectX+ellipseOffset+fudgeFactor));

    // Palette can also be toggled open and closed without changing the alignment type
    drawToolTile.getDrawToolAlignExpand().click(); // Open palette via triangle button
    drawToolTile.getDrawToolAlignOptions().should("exist").and("be.visible").and("have.length", 6);
    drawToolTile.getDrawToolAlignExpand().click(); // Close palette via triangle button
    drawToolTile.getDrawToolAlignOptions().should("not.exist");
    clueCanvas.getToolbarButtonToolTipText('drawing', 'align').should("eq", "Align left");

    // Undo the alignment
    clueCanvas.getUndoTool().click();
    drawToolTile.getRectangleDrawing().eq(0).invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(rectX+rectOffset-fudgeFactor, rectX+rectOffset+fudgeFactor));
    drawToolTile.getFreehandDrawing().eq(0).invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(freehandX+freehandOffset-fudgeFactor, freehandX+freehandOffset+fudgeFactor));
    drawToolTile.getEllipseDrawing().eq(0).invoke('attr', 'transform')
      .then(transform =>
        expect(parseTransform(transform, 'translate')[0]).to.be.within(ellipseX+ellipseOffset-fudgeFactor, ellipseX+ellipseOffset+fudgeFactor));

    // Change alignment type
    drawToolTile.getDrawToolAlignExpand().click(); // Open palette via triangle button
    drawToolTile.getDrawToolAlignOptions().eq(2).click(); // Aligns shapes right and closes palette
    drawToolTile.getDrawToolAlignOptions().should("not.exist");
    clueCanvas.getToolbarButtonToolTipText('drawing', 'align').should("eq", "Align right");
  });

  it("Image", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("drags images from image tiles");
    const imageFilePath1 = 'image.png';
    clueCanvas.addTile('image');
    cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath1, 'image/png');
    cy.wait(2000);
    // Doesn't seem like the image is actually loading into the image tile.
    // Once that's fixed, we should drag that image into the drawing tile.

    cy.log("uploads images");
    drawToolTile.getDrawTile().click();
    const imageFilePath2 = 'image.png';
    cy.uploadFile(drawToolTile.getDrawToolUploadImage(), imageFilePath2, 'image/png');
    cy.wait(2000);
    // Uploading images doesn't seem to be working at the moment.
    // drawToolTile.getImageDrawing().should("exist").and("have.length", 1);

    // TODO: Figure out how to get the clipboard paste check below to work when the tests
    // are run using Chrome. It will pass when using Electron, but not Chrome. In Chrome
    // the attempt to write to the clipboard results in an error: "Must be handling a user
    // gesture to use custom clipboard." See https://github.com/cypress-io/cypress/issues/2752
    // for more background. Apparently, the basic problem is that Cypress "currently uses
    // programmatic browser APIs which Chrome doesn't consider as genuine user interaction."
    // it.skip('will accept a valid image URL pasted from the clipboard', function () {
    //   // For the drawing tool, this path needs to correspond to an actual file in the curriculum repository.
    //   const imageFilePath = "curriculum/sas/images/survey.png";
    //   Cypress.automation("remote:debugger:protocol", {
    //     command: "Browser.grantPermissions",
    //     params: {
    //       permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
    //       origin: window.location.origin,
    //     },
    //   }).then(cy.window().then((win) => {
    //     win.navigator.clipboard.write([new win.ClipboardItem({
    //       "text/plain": new Blob([imageFilePath], { type: "text/plain" }),
    //     })]);
    //   }));
    //   const isMac = navigator.platform.indexOf("Mac") === 0;
    //   const cmdKey = isMac ? "meta" : "ctrl";
    //   drawToolTile.getDrawTileComponent().last().type(`{${cmdKey}+v}`);
    //   drawToolTile.getImageDrawing().last().should("exist").invoke("attr", "href").should("contain", "sas/images/survey.png");
    // });
  });

  it("Can rotate and flip objects", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("Rotate a text object");
    drawToolTile.addText(50, 10, "Spin me!");
    drawToolTile.getTextDrawing().should("have.length", 1);
    drawToolTile.getTextDrawing().eq(0).click();
    drawToolTile.getSelectionBox().should("exist");
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([0]);
    });
    clueCanvas.clickToolbarButton('drawing', 'rotate-right');
    drawToolTile.getTextDrawing().should("have.length", 1);
    cy.wait(300); // wait for animation to complete
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([90]);
    });
    clueCanvas.clickToolbarButton('drawing', 'rotate-right');
    cy.wait(300);
    drawToolTile.getTextDrawing().should("have.length", 1);
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([180]);
    });
    clueCanvas.getUndoTool().click();
    cy.wait(300);
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([90]);
    });

    clueCanvas.clickToolbarButton('drawing', 'flip-horizontal');
    cy.wait(300);
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([1,-1]); // horizontal flip of rotated object -> Y axis flip
    });
    clueCanvas.getUndoTool().click();
    cy.wait(300);

    clueCanvas.getUndoTool().click();
    cy.wait(300);
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([0]);
    });

    clueCanvas.clickToolbarButton('drawing', 'rotate-right', { altKey: true });
    cy.wait(300);
    clueCanvas.clickToolbarButton('drawing', 'rotate-right', { altKey: true });
    cy.wait(300);
    clueCanvas.clickToolbarButton('drawing', 'rotate-right', { altKey: true });
    cy.wait(300);
    drawToolTile.getTextDrawing().should("have.length", 4);
    drawToolTile.getTextDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([0]);
    });
    drawToolTile.getTextDrawing().eq(1).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([90]);
    });
    drawToolTile.getTextDrawing().eq(2).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([180]);
    });
    drawToolTile.getTextDrawing().eq(3).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'rotate')).to.deep.equal([270]);
    });
    drawToolTile.getTextDrawing().eq(0).click();
    drawToolTile.getTextDrawing().eq(1).click({shiftKey: true});
    drawToolTile.getTextDrawing().eq(2).click({shiftKey: true});
    drawToolTile.getTextDrawing().eq(3).click({shiftKey: true});
    drawToolTile.getSelectionBox().should("have.length", 4);
    drawToolTile.getDrawToolDelete().click();

    cy.log("Flip a rectangle");
    drawToolTile.drawRectangle(50, 50, 100, 50);
    drawToolTile.getRectangleDrawing().invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([1,1]);
    });
    clueCanvas.clickToolbarButton('drawing', 'flip-horizontal');
    cy.wait(500); // wait for animation to complete
    drawToolTile.getRectangleDrawing().invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([-1,1]);

    });
    clueCanvas.clickToolbarButton('drawing', 'flip-vertical');
    cy.wait(500);
    drawToolTile.getRectangleDrawing().invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([-1,-1]);

    });
    clueCanvas.clickToolbarButton('drawing', 'delete');

    cy.log("Flip an ellipse, with copy");
    drawToolTile.drawEllipse(100, 50, 75, 25);
    clueCanvas.clickToolbarButton('drawing', 'flip-horizontal', { altKey: true });
    cy.wait(500);
    drawToolTile.getEllipseDrawing().should("have.length", 2);
    drawToolTile.getEllipseDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([1,1]);
    });
    drawToolTile.getEllipseDrawing().eq(1).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([-1,1]);
    });
    clueCanvas.clickToolbarButton('drawing', 'flip-vertical', { altKey: true });
    cy.wait(500);
    drawToolTile.getEllipseDrawing().should("have.length", 3);
    drawToolTile.getEllipseDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([1,1]);

    });
    drawToolTile.getEllipseDrawing().eq(1).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([-1,1]);

    });
    drawToolTile.getEllipseDrawing().eq(2).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([-1,-1]);

    });
    clueCanvas.clickToolbarButton('drawing', 'delete');
    drawToolTile.getEllipseDrawing().eq(1).click();
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getEllipseDrawing().eq(0).click();
    drawToolTile.getDrawToolDelete().click();
    drawToolTile.getEllipseDrawing().should("not.exist");

    cy.log("Flip a group");
    drawToolTile.drawVector(150, 50, 30, 0);
    drawToolTile.drawFreehand([{x: 200, y: 40}, {x: 220, y: 50}, {x: 200, y: 60}]);
    drawToolTile.dragSelectionRectangle(140, 40, 260, 60);
    clueCanvas.clickToolbarButton('drawing', 'group');
    // The freehand triangle is to the right of the vector
    drawToolTile.getFreehandDrawing().then($el => {
      const triangleOffset = $el.offset().left;
      drawToolTile.getVectorDrawing().then($vec => {
        const vectorOffset = $vec.offset().left;
        expect(triangleOffset).to.be.greaterThan(vectorOffset);
      });
    });
    // Flip the group
    clueCanvas.clickToolbarButton('drawing', 'flip-horizontal');
    cy.wait(500);
    drawToolTile.getGroupDrawing().eq(0).invoke('attr', 'transform').then(transform => {
      expect(parseTransform(transform, 'scale')).to.deep.equal([-1,1]);
    });

    // Now triangle should be to the left of the vector
    drawToolTile.getFreehandDrawing().then($el => {
      const triangleOffset = $el.offset().left;
      drawToolTile.getVectorDrawing().then($vec => {
        const vectorOffset = $vec.offset().left;
        expect(triangleOffset).to.be.lessThan(vectorOffset);
      });
    });
  });

  it("rejects non-primary pointer events", { scrollBehavior: false }, () => {
    beforeTest();
    clueCanvas.addTile("drawing");

    cy.log("verify rectangle tool rejects non-primary events");
    drawToolTile.getDrawToolRectangle().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { isPrimary: false })
      .trigger("pointermove", 200, 150, { isPrimary: false })
      .trigger("pointerup", 200, 150, { isPrimary: false });
    drawToolTile.getRectangleDrawing().should("not.exist");

    cy.log("verify ellipse tool rejects non-primary events");
    drawToolTile.getDrawToolEllipse().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { isPrimary: false })
      .trigger("pointermove", 200, 150, { isPrimary: false })
      .trigger("pointerup", 200, 150, { isPrimary: false });
    drawToolTile.getEllipseDrawing().should("not.exist");

    cy.log("verify freehand tool rejects non-primary events");
    drawToolTile.getDrawToolFreehand().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { isPrimary: false })
      .trigger("pointermove", 200, 150, { isPrimary: false })
      .trigger("pointerup", 200, 150, { isPrimary: false });
    drawToolTile.getFreehandDrawing().should("not.exist");

    cy.log("verify vector tool rejects non-primary events");
    drawToolTile.getDrawToolVector().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { isPrimary: false })
      .trigger("pointermove", 200, 150, { isPrimary: false })
      .trigger("pointerup", 200, 150, { isPrimary: false });
    drawToolTile.getVectorDrawing().should("not.exist");

    cy.log("verify text tool rejects non-primary events");
    drawToolTile.getDrawToolText().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { isPrimary: false })
      .trigger("pointerup", 100, 50, { isPrimary: false });
    drawToolTile.getTextDrawing().should("not.exist");

    cy.log("verify stamp tool rejects non-primary events");
    drawToolTile.getDrawToolStamp().click();
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 100, 50, { isPrimary: false })
      .trigger("pointerup", { isPrimary: false });
    drawToolTile.getImageDrawing().should("not.exist");

    cy.log("verify selection tool rejects non-primary events");
    // First create something to try to select
    drawToolTile.drawRectangle(100, 50, 100, 100);
    // Deselect the rectangle
    drawToolTile.getDrawTile().click(50, 50);

    drawToolTile.getDrawToolSelect().click();
    drawToolTile.getSelectionBox().should("not.exist");
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 90, 40, { isPrimary: false })
      .trigger("pointermove", 210, 160, { isPrimary: false })
      .trigger("pointerup", 210, 160, { isPrimary: false });
    drawToolTile.getSelectionBox().should("not.exist");

    cy.log("verify moving objects rejects non-primary events");
    // First select the rectangle normally
    drawToolTile.getDrawTile()
      .trigger("pointerdown", 90, 40, { isPrimary: true })
      .trigger("pointermove", 210, 160, { isPrimary: true })
      .trigger("pointerup", 210, 160, { isPrimary: true });
    drawToolTile.getSelectionBox().should("exist");

    // Try to move with non-primary events
    drawToolTile.getRectangleDrawing().find("rect").invoke('attr', 'x').then(x => {
      const originalX = parseInt(x, 10);
      drawToolTile.getDrawTile()
        .trigger("pointerdown", 150, 100, { isPrimary: false })
        .trigger("pointermove", 250, 100, { isPrimary: false })
        .trigger("pointerup", 250, 100, { isPrimary: false });

      drawToolTile.getRectangleDrawing().find("rect").invoke('attr', 'x').then(newX => {
        expect(parseInt(newX, 10)).to.equal(originalX);
      });
    });
  });

  it('Draw Tool Tile Undo Redo', function () {
    beforeTest();
    cy.log('will undo redo drawing tile creation/deletion');
    // Creation - Undo/Redo
    clueCanvas.addTile('drawing');
    drawToolTile.getDrawTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    drawToolTile.getDrawTile().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    drawToolTile.getDrawTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");

    // Deletion - Undo/Redo
    clueCanvas.deleteTile('draw');
    drawToolTile.getDrawTile().should('not.exist');
    clueCanvas.getUndoTool().click();
    drawToolTile.getDrawTile().should("exist");
    clueCanvas.getRedoTool().click();
    drawToolTile.getDrawTile().should('not.exist');

    cy.log("edit tile title");
    const newName = "Drawing Tile";
    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTile().should("exist");
    drawToolTile.getTileTitle().should("exist");
    drawToolTile.getTileTitle().first().should("contain", "Sketch 1");
    drawToolTile.getDrawTileTitle().first().click();
    drawToolTile.getDrawTileTitle().first().type(newName + '{enter}');
    drawToolTile.getTileTitle().should("contain", newName);

    cy.log("undo redo actions");
    clueCanvas.getUndoTool().click();
    drawToolTile.getTileTitle().first().should("contain", "Sketch 1");
    clueCanvas.getUndoTool().click();
    drawToolTile.getDrawTile().should("not.exist");
    clueCanvas.getRedoTool().click().click();
    drawToolTile.getTileTitle().should("contain", "Drawing Tile");

    cy.log('verify delete tile');
    clueCanvas.deleteTile('draw');
    drawToolTile.getDrawTile().should("not.exist");
  });

  // TODO: Figure out how to get paste to work in Cypress with Chrome.
  // See the comment in the Image test above for more details.
  // it.skip('Allows a user to copy and paste objects using hot keys', function () {
  //   beforeTest();

  //   clueCanvas.addTile("drawing");
  //   cy.log("draw a rectangle");
  //   drawToolTile.drawRectangle(100, 50, 150, 100);

  //   cy.log("copy and paste the rectangle");
  //   const isMac = navigator.platform.indexOf("Mac") === 0;
  //   const cmdKey = isMac ? "meta" : "ctrl";
  //   drawToolTile.getRectangleDrawing().last().click({ force: true })
  //     .type(`{${cmdKey}+c}`, { force: true })
  //     .type(`{${cmdKey}+v}`, { force: true });

  //   drawToolTile.getRectangleDrawing().should("have.length", 2);
  // });
});
