import ClueCanvas from "../../../support/elements/common/cCanvas";
import TileNavigator from "../../../support/elements/tile/TileNavigator";
import DrawToolTile from "../../../support/elements/tile/DrawToolTile";
import { LogEventName } from "../../../../src/lib/logger-types";
import GeometryToolTile from "../../../support/elements/tile/GeometryToolTile";

let clueCanvas = new ClueCanvas,
    drawToolTile = new DrawToolTile,
    geometryTile = new GeometryToolTile,
    tileNavigator = new TileNavigator;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context("Tile Navigator", () => {
  it("renders with draw and geometry tiles", () => {
    beforeTest();

    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTile().should("exist");
    tileNavigator.getTileNavigator().should("exist");

    clueCanvas.toolbarButtonIsEnabled("drawing", "navigator");
    clueCanvas.getToolbarButtonToolTip("drawing", "navigator").should("exist");
    clueCanvas.getToolbarButtonToolTipText("drawing", "navigator").should("eq", "Hide Navigator");

    cy.log("Draw a rectangle");
    drawToolTile.drawRectangle(100, 50, 20, 20);
    tileNavigator.getRectangleDrawing().should("exist").and("have.length", 1);

    clueCanvas.deleteTile("draw");
    tileNavigator.getTileNavigator().should("not.exist");

    clueCanvas.addTile("geometry");
    tileNavigator.getTileNavigator().should("exist");
    clueCanvas.toolbarButtonIsEnabled("geometry", "navigator");
    clueCanvas.getToolbarButtonToolTip("geometry", "navigator").should("exist");
    clueCanvas.getToolbarButtonToolTipText("geometry", "navigator").should("eq", "Hide Navigator");

    geometryTile.getGraphPoint().should("not.exist");
    tileNavigator.getGeometryPoint().should("not.exist");
    clueCanvas.clickToolbarButton("geometry", "point");
    geometryTile.clickGraphPosition(20, 20);
    geometryTile.getGraphPoint().should("exist").and("have.length", 1);
    tileNavigator.getGeometryPoint().should("exist").and("have.length", 1);
  });

  it("can be hidden and shown", () => {
    beforeTest();

    cy.window().then(win => {
      cy.stub(win.ccLogger, "log").as("log");
    });

    for(let tileType of ["drawing", "geometry"]) {
      clueCanvas.addTile(tileType);
      cy.log(`Testing ${tileType} navigator`);
      const logEventName = tileType === "drawing" ? LogEventName.DRAWING_TOOL_CHANGE : LogEventName.GEOMETRY_TOOL_CHANGE;

      // FIXME: Ideally, we would use "not.exist" for both tile types, but the geometry tile's navigator is
      // implemented with visibility:hidden instead of being removed from the DOM. So we have to use
      // "not.be.visible" for that case. See comment about navigator in geometry-tile.tsx for more context.
      const presenceTestString = tileType === "geometry" ? "not.be.visible" : "not.exist";

      clueCanvas.clickToolbarButton(tileType, "navigator");
      clueCanvas.getToolbarButtonToolTipText(tileType, "navigator").should("eq", "Show Navigator");
      tileNavigator.getTileNavigator().should(presenceTestString);
      cy.get("@log")
        .should("have.been.been.calledWith", logEventName, Cypress.sinon.match.object)
        .its("lastCall.args.1").should("deep.include", { operation: "hideNavigator" });

      clueCanvas.clickToolbarButton(tileType, "navigator");
      clueCanvas.getToolbarButtonToolTipText(tileType, "navigator").should("eq", "Hide Navigator");
      tileNavigator.getTileNavigator().should("exist");
      cy.get("@log")
        .should("have.been.been.calledWith", logEventName, Cypress.sinon.match.object)
        .its("lastCall.args.1").should("deep.include", { operation: "showNavigator" });
      clueCanvas.deleteTile(tileType);
    }
  });

  it("displays the current zoom level", () => {
    beforeTest();

    clueCanvas.addTile("drawing");
    drawToolTile.drawEllipse(50, 55, 100, 50);
    cy.get(".tile-navigator .zoom-level").should("have.text", "100%");

    cy.log("Zoom in from 100% to the max zoom level, 200%");
    for (let i = 1; i < 11; i++) {
      clueCanvas.clickToolbarButton("drawing", "zoom-in");
      cy.get(".tile-navigator .zoom-level").should("have.text", `${100 + i * 10}%`);
    }

    cy.log("Zoom out from 200% to the min zoom level, 10%");
    for (let i = 1; i < 20; i++) {
      clueCanvas.clickToolbarButton("drawing", "zoom-out");
      cy.get(".tile-navigator .zoom-level").should("have.text", `${200 - i * 10}%`);
    }

    cy.log("Click the Fit All button then zoom out");
    clueCanvas.clickToolbarButton("drawing", "fit-all");
    cy.get(".tile-navigator .zoom-level").should("have.text", "166%");
    clueCanvas.clickToolbarButton("drawing", "zoom-out");
    cy.get(".tile-navigator .zoom-level").should("have.text", "160%");
    clueCanvas.deleteTile("drawing");

    clueCanvas.addTile("geometry");
    cy.get(".tile-navigator .zoom-level").should("have.text", "100%");
    clueCanvas.clickToolbarButton("geometry", "zoom-in");
    cy.get(".tile-navigator .zoom-level").should("have.text", "125%");
    clueCanvas.clickToolbarButton("geometry", "zoom-in");
    cy.get(".tile-navigator .zoom-level").should("have.text", "156%");
    clueCanvas.clickToolbarButton("geometry", "zoom-out");
    cy.get(".tile-navigator .zoom-level").should("have.text", "125%");
    clueCanvas.clickToolbarButton("geometry", "zoom-out");
    cy.get(".tile-navigator .zoom-level").should("have.text", "100%");
    clueCanvas.clickToolbarButton("geometry", "zoom-out");
    cy.get(".tile-navigator .zoom-level").should("have.text", "80%");
    clueCanvas.deleteTile("geometry");
  });

  it("is at the bottom of the tile by default but can be moved to the top", () => {
    beforeTest();

    for(let tileType of ["drawing", "geometry"]) {
      clueCanvas.addTile(tileType);
      if (tileType === "drawing") {
        drawToolTile.getDrawTile().click();
      } else {
        geometryTile.getGeometryTile().click();
      }
      tileNavigator.getTileNavigator().should("exist").and("not.have.class", "top");

      cy.log("Move tile navigator to the top of the drawing tile in a quick animation");
      tileNavigator.getTileNavigatorPlacementButton().click();
      cy.wait(300);
      tileNavigator.getTileNavigatorContainer().should("have.class", "top");

      cy.log("Move tile navigator to the bottom of the drawing tile in a quick animation");
      tileNavigator.getTileNavigatorPlacementButton().click();
      cy.wait(300);
      tileNavigator.getTileNavigatorContainer().should("not.have.class", "top");
      clueCanvas.deleteTile(tileType);
    }
  });

  it("provides panning buttons", () => {
    beforeTest();

    clueCanvas.addTile("drawing");
    drawToolTile.getDrawTile().click();

    tileNavigator.getTileNavigatorPanningButtons().should("exist");
    tileNavigator.getTileNavigatorPanningButtons().find('button').should("have.length", 4);
    drawToolTile.getDrawTileObjectCanvas().should("have.attr", "transform", "translate(0, 0) scale(1)");

    cy.log("Draw an ellipse that partially extends beyond the viewport's left boundary");
    drawToolTile.drawEllipse(50, 55, 100, 50);

    cy.log("Click the left panning button twice to shift the drawing canvas 100 pixels to the right");
    tileNavigator.getTileNavigatorPanningButton("left").click().click();
    drawToolTile.getDrawTileObjectCanvas().should("have.attr", "transform", "translate(100, 0) scale(1)");

    cy.log("Draw an ellipse that partially extends beyond the viewport's right boundary");
    drawToolTile.drawEllipse(1200, 55, 100, 50);
    clueCanvas.clickToolbarButton("drawing", "zoom-in");
    clueCanvas.clickToolbarButton("drawing", "zoom-in");

    cy.log("Click the right panning button twice to shift the drawing canvas 100 pixels to the left");
    tileNavigator.getTileNavigatorPanningButton("right").click().click();
    tileNavigator.getTileNavigatorPanningButtons().should("exist");
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: -131, y: -17 };
      const expectedScale = 1.2;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });

    cy.log("Click the up panning button once to shift the drawing canvas 50 pixels down");
    tileNavigator.getTileNavigatorPanningButton("up").click();
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: -131, y: 32 };
      const expectedScale = 1.2;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });

    cy.log("Click the down panning button once to shift the drawing canvas 50 pixels up");
    tileNavigator.getTileNavigatorPanningButton("down").click();
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: -131, y: -17 };
      const expectedScale = 1.2;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });

    cy.log("Click the Fit All button to bring all content into view");
    clueCanvas.clickToolbarButton("drawing", "fit-all");
    drawToolTile.getDrawTileObjectCanvas().then(canvas => {
      const expectedTranslationValues = { x: 89, y: 33 };
      const expectedScale = 1.04;
      drawToolTile.verifyTransformValues(canvas.attr('transform'), expectedTranslationValues, expectedScale);
    });

    clueCanvas.deleteTile("drawing");

    cy.log("Test panning buttons in Geometry tile");
    clueCanvas.addTile("geometry");
    geometryTile.getGraphAxisTickLabels().should("exist");
    geometryTile.getGraphAxisTickLabels().eq(0).should("have.text", "0");
    // Pan right to move the "0" off the left side.
    tileNavigator.getTileNavigatorPanningButton("right").click().click();
    geometryTile.getGraphAxisTickLabels().eq(0).should("have.text", "5");
    tileNavigator.getTileNavigatorPanningButton("left").click().click();
    geometryTile.getGraphAxisTickLabels().eq(0).should("have.text", "0");
  });
});
