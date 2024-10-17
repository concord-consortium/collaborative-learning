import ClueCanvas from "../../../support/elements/common/cCanvas";
import TileNavigator from "../../../support/elements/tile/TileNavigator";
import DrawToolTile from "../../../support/elements/tile/DrawToolTile";
import { LogEventName } from "../../../../src/lib/logger-types";

let clueCanvas = new ClueCanvas,
    drawToolTile = new DrawToolTile,
    tileNavigator = new TileNavigator;

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context("Tile Navigator", () => {
  it("renders with a draw tool tile by default", () => {
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
  });
  it("can be hidden and shown", () => {
    beforeTest();

    cy.window().then(win => {
      cy.stub(win.ccLogger, "log").as("log");
    });

    clueCanvas.addTile("drawing");
    cy.log("Hide tile navigator");
    clueCanvas.clickToolbarButton("drawing", "navigator");
    clueCanvas.getToolbarButtonToolTipText("drawing", "navigator").should("eq", "Show Navigator");
    tileNavigator.getTileNavigator().should("not.exist");
    cy.get("@log")
      .should("have.been.been.calledWith", LogEventName.DRAWING_TOOL_CHANGE, Cypress.sinon.match.object)
      .its("lastCall.args.1").should("deep.include", { operation: "hideNavigator" });

    cy.log("Show tile navigator");
    clueCanvas.clickToolbarButton("drawing", "navigator");
    clueCanvas.getToolbarButtonToolTipText("drawing", "navigator").should("eq", "Hide Navigator");
    tileNavigator.getTileNavigator().should("exist");
    cy.get("@log")
      .should("have.been.been.calledWith", LogEventName.DRAWING_TOOL_CHANGE, Cypress.sinon.match.object)
      .its("lastCall.args.1").should("deep.include", { operation: "showNavigator" });
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
  });
  it("is at the bottom of the drawing tile by default but can be moved to the top", () => {
    beforeTest();

    clueCanvas.addTile("drawing");
    tileNavigator.getTileNavigator().should("exist").and("not.have.class", "top");

    cy.log("Move tile navigator to the top of the drawing tile in a quick animation");
    tileNavigator.getTileNavigatorPlacementButton().click();
    cy.wait(300);
    tileNavigator.getTileNavigatorContainer().should("have.class", "top");

    cy.log("Move tile navigator to the bottom of the drawing tile in a quick animation");
    tileNavigator.getTileNavigatorPlacementButton().click();
    cy.wait(300);
    tileNavigator.getTileNavigatorContainer().should("not.have.class", "top");
  });
  it("provides panning buttons when elements extend beyond the viewport boundaries", () => {
    beforeTest();

    clueCanvas.addTile("drawing");
    tileNavigator.getTileNavigatorPanningButtons().should("not.exist");
    drawToolTile.getDrawTileObjectCanvas().should("have.attr", "transform", "translate(0, 0) scale(1)");

    cy.log("Draw an ellipse that partially extends beyond the viewport's left boundary");
    drawToolTile.drawEllipse(50, 55, 100, 50);
    tileNavigator.getTileNavigatorPanningButtons().should("exist");
    tileNavigator.getTileNavigatorPanningButtons().find('button').should("have.length", 4);

    cy.log("Click the left panning button twice to shift the drawing canvas 100 pixels to the right");
    tileNavigator.getTileNavigatorPanningButton("left").click().click();
    tileNavigator.getTileNavigatorPanningButtons().should("not.exist");
    drawToolTile.getDrawTileObjectCanvas().should("have.attr", "transform", "translate(100, 0) scale(1)");

    cy.log("Draw an ellipse that partially extends beyond the viewport's right boundary");
    drawToolTile.drawEllipse(1200, 55, 100, 50);
    clueCanvas.clickToolbarButton("drawing", "zoom-in");
    clueCanvas.clickToolbarButton("drawing", "zoom-in");
    tileNavigator.getTileNavigatorPanningButtons().should("exist");

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

    tileNavigator.getTileNavigatorPanningButtons().should("exist");

    cy.log("Click the Fit All button to bring all content into view");
    clueCanvas.clickToolbarButton("drawing", "fit-all");
    tileNavigator.getTileNavigatorPanningButtons().should("not.exist");
  });
});
