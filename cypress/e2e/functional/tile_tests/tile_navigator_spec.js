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
});
