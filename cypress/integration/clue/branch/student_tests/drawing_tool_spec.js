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
          .trigger("mousedown", 350, 50)
          .trigger("mousemove", 350, 100)
          .trigger("mousemove", 450, 100)
          .trigger("mouseup",   350, 100);
        drawToolTile.getFreehandDrawing().should("exist").and("have.length", 1);
      });
      it("selects freehand drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        // First make sure we don't select it even if we are inside of its 
        // bounding box
        drawToolTile.getDrawTile()
          .trigger("mousedown", 370, 50)
          .trigger("mousemove", 450, 80)
          .trigger("mouseup",   450, 80);
        drawToolTile.getDrawToolDelete().should("have.class", "disabled");

        drawToolTile.getDrawTile()
          .trigger("mousedown", 340, 90)
          .trigger("mousemove", 360, 110)
          .trigger("mouseup",   360, 110);
        drawToolTile.getDrawToolDelete().should("not.have.class", "disabled");
      });
      it("deletes freehand drawing", () => {
        // Without the previous test this is how to select it, using the simple click
        // approach doesn't seem to work well with paths, the location that cypress clicks
        // is not on the path
        // drawToolTile.getDrawToolSelect().click();
        // drawToolTile.getDrawTile()
        //   .trigger("mousedown", 350, 100)
        //   .trigger("mouseup", 350, 100);
        drawToolTile.getSelectionBox().should("exist");
        drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click();
        drawToolTile.getFreehandDrawing().should("not.exist");
      });
    });
    describe("Vector", () => {
      it("verify draw vector", () => {
        drawToolTile.getDrawToolLine().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100, 50)
          .trigger("mouseup",   100, 50);
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
          .trigger("mousedown", 250,  50)
          .trigger("mousemove", 100, 150)
          .trigger("mouseup",   100,  50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
      });
      it("verify change outline color", () => {
        drawToolTile.getRectangleDrawing().first().should("have.attr", "stroke").and("eq", "#000000");
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().click({force:true});
        drawToolTile.getDrawToolStrokeColor().click();
        cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").last().click();
        drawToolTile.getRectangleDrawing().first().should("have.attr", "stroke").and("eq", "#d100d1");
      });
      it("verify change fill color", () => {
        drawToolTile.getRectangleDrawing().first().should("not.have.attr", "fill-color");
        // The rectangle is already selected
        // drawToolTile.getDrawToolSelect().click();
        // drawToolTile.getRectangleDrawing().click({force:true});
        drawToolTile.getDrawToolFillColor().click();
        cy.get(".toolbar-palette.fill-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.fill-color .palette-buttons .color-swatch").last().click();
        drawToolTile.getRectangleDrawing().first().should("have.attr", "fill").and("eq", "#d100d1");
      });
      it("verify move object", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 100, 100)
          .trigger("mousemove", 200, 100)
          .trigger("mouseup", 200, 100);
        drawToolTile.getRectangleDrawing().first().should("have.attr", "x").then(parseInt).and("within", 170, 220);
      });
      it("verify draw squares", () => {
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 450, 50, {ctrlKey: true})
          .trigger("mousemove", 450, 100,{ctrlKey: true})
          .trigger("mouseup",   450, 100);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 2);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "46");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "46");

        drawToolTile.getDrawTile()
          .trigger("mousedown", 650, 50, {ctrlKey: true})
          .trigger("mousemove", 710, 50,{ctrlKey: true})
          .trigger("mouseup",   710, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 3);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "60");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "60");  
      });
      it("deletes rectangle drawings", () => {
        drawToolTile.getDrawTile().click();
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().first().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getRectangleDrawing().first().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getRectangleDrawing().first().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getRectangleDrawing().should("not.exist");
      });
    });
    describe("Ellipse", () => {
      it("verify draw ellipse", () => {
        drawToolTile.getDrawToolEllipse().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250,  50)
          .trigger("mousemove", 100, 150)
          .trigger("mouseup",   100, 150);
        drawToolTile.getEllipseDrawing().should("exist").and("have.length", 1);
      });
      it("verify draw circle", () => {
        drawToolTile.getDrawToolEllipse().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 450,  50, {ctrlKey: true})
          .trigger("mousemove", 450, 150, {ctrlKey: true})
          .trigger("mouseup",   450, 150);
        drawToolTile.getEllipseDrawing().should("exist").and("have.length", 2);
        drawToolTile.getEllipseDrawing().last().should("have.attr", "rx").and("eq", "100");
        drawToolTile.getEllipseDrawing().last().should("have.attr", "ry").and("eq", "100");
      });
      it("deletes ellipse drawing", () => {
        drawToolTile.getDrawTile().click();
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getEllipseDrawing().first().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getEllipseDrawing().first().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getEllipseDrawing().should("not.exist");
      });
    });
    describe("Stamp", () => {
      it("verify draw stamp", () => {
        drawToolTile.getDrawToolStamp().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mouseup");
        drawToolTile.getImageDrawing().should("exist").and("have.length", 1);
      });
      it("deletes stamp drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getImageDrawing().click({force:true});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getImageDrawing().should("not.exist");
      });
    });
  });
});
