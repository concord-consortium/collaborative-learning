import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';

let clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile;


context('Table Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=msa";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
  });
  describe("Draw Tool", () => {
    it("renders draw tool tile", () => {
      clueCanvas.addTile("drawing");
      drawToolTile.getDrawTile().should("exist");
    });
    describe("Freehand", () => {
      it("verify draw a line", () => {
        drawToolTile.getDrawToolFreehand().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100,50)
          .trigger("mouseup");
        drawToolTile.getFreehandDrawing().should("exist").and("have.length", 1);
      });
      it("deletes freehand drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getFreehandDrawing().click();
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getFreehandDrawing().should("not.exist");
      });
    });
    describe("Vector", () => {
      it("verify draw vector", () => {
        drawToolTile.getDrawToolLine().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100,50)
          .trigger("mouseup");
        drawToolTile.getVectorDrawing().should("exist").and("have.length", 1);
      });
      it("deletes vector drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getVectorDrawing().click();
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getVectorDrawing().should("not.exist");
      });
    });
    describe("Rectangle", () => {
      it("verify draw rectangle", () => {
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100,150)
          .trigger("mouseup");
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
      });
      it.skip("verify change outline color", () => {
        drawToolTile.getRectangleDrawing().first().should("have.attr", "stroke").and("eq", "#000000");
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().click({force:true});
        drawToolTile.getDrawToolStrokeColor().click();
        cy.get(".toolbar-palette.stroke-color palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.stroke-color palette-buttons color-swatch").last().click();
        drawToolTile.getRectangleDrawing().first().should("have.attr", "stroke").and("eq", "#d100d1");
      });
      it.skip("verify change fill color", () => {
        drawToolTile.getRectangleDrawing().first().should("have.attr", "fill-color").and("eq", "none");
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().click({force:true});
        drawToolTile.getDrawToolStrokeColor().click();
        cy.get(".toolbar-palette.fill-color palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.fill-color palette-buttons color-swatch").last().click();
        drawToolTile.getRectangleDrawing().first().should("have.attr", "fill-color").and("eq", "#d100d1");
      });
      it("deletes rectangle drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().first().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getRectangleDrawing().should("not.exist");
      });
    });
    describe("Ellipse", () => {
      it("verify draw ellipse", () => {
        drawToolTile.getDrawToolEllipse().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100,150)
          .trigger("mouseup");
        drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);
      });
      it("deletes ellipse drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getEllipseDrawing().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getEllipseDrawing().should("not.exist");
      });
    });
    describe("Line Color", () => {
      it("verify draw ellipse", () => {
        drawToolTile.getDrawToolEllipse().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100,150)
          .trigger("mouseup");
        drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);
      });
      it("deletes ellipse drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getEllipseDrawing().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getEllipseDrawing().should("not.exist");
      });
    });
    describe.skip("Stamp", () => {
      it("verify draw stamp", () => {
        drawToolTile.getDrawToolStamp().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100,150)
          .trigger("mouseup");
        drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);
      });
      it("deletes stamp drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getEllipseDrawing().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getEllipseDrawing().should("not.exist");
      });
    });
  });
});
