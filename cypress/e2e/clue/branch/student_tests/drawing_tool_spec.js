import DrawToolTile from '../../../../support/elements/clue/DrawToolTile';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import ImageToolTile from '../../../../support/elements/clue/ImageToolTile';

let clueCanvas = new ClueCanvas,
  drawToolTile = new DrawToolTile;
const imageToolTile = new ImageToolTile;

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

context('Draw Tool Tile', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=msa";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.closeResourceTabs();
  });
  describe("Draw Tool", () => {
    it("renders draw tool tile", () => {
      clueCanvas.addTile("drawing");
      drawToolTile.getDrawTile().should("exist");
      drawToolTile.getTileTitle().should("exist");
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
        drawToolTile.getVectorDrawing().click({scrollBehavior: false});
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
        drawToolTile.getRectangleDrawing().click({force:true, scrollBehavior: false});
        drawToolTile.getDrawToolStrokeColor().click();
        cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").last().click();
        drawToolTile.getRectangleDrawing().first().should("have.attr", "stroke").and("eq", "#d100d1");
      });
      it("verify change fill color", () => {
        drawToolTile.getRectangleDrawing().first().should("not.have.attr", "fill-color");
        // The rectangle is already selected, so we don't need to select it again
        drawToolTile.getDrawToolFillColor().click();
        cy.get(".toolbar-palette.fill-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.fill-color .palette-buttons .color-swatch").last().click();
        drawToolTile.getRectangleDrawing().first().should("have.attr", "fill").and("eq", "#d100d1");
      });
      it("verify moving pre-selected object", () => {
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 100, 100)
          .trigger("mousemove", 200, 100)
          .trigger("mouseup", 200, 100);
        // For some reason the move isn't very accurate in cypress so often the final location off
        drawToolTile.getRectangleDrawing().first().should("have.attr", "x").then(parseInt).and("within", 160, 220);
      });
      it("verify hovering objects", () => {
        drawToolTile.getDrawTile()
          // Un-select the rectangle
          .trigger("mousedown", 500, 100)
          .trigger("mouseup", 500, 100);

        drawToolTile.getRectangleDrawing().first()
          // Get the rectangle to be hovered. In the code we are listening to
          // `onMouseEnter` but in Cypress triggering a "mouseenter" event
          // doesn't work. Triggering a "mouseover" does work for some reason.
          .trigger("mouseover", {scrollBehavior: false});

        // The hover box is rendered as a selection-box with a different color
        drawToolTile.getSelectionBox().should("exist").should("have.attr", "stroke").and("eq", "#bbdd00");

        // The best way I found to remove the hover was to delete the rectangle
        drawToolTile.getRectangleDrawing().first().click({force: true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getSelectionBox().should("not.exist");

      });
      it("verify moving not selected object", () => {
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250,  50)
          .trigger("mousemove", 100, 150)
          .trigger("mouseup",   100, 150);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);

        drawToolTile.getDrawToolSelect().click();

        // Get the rectangle to be hovered, see above for more info.
        drawToolTile.getRectangleDrawing()
          .trigger("mouseover", {scrollBehavior: false});
        drawToolTile.getSelectionBox().should("exist").should("have.attr", "stroke").and("eq", "#bbdd00");

        drawToolTile.getDrawTile()
          .trigger("mousedown", 100, 135)
          .trigger("mousemove", 200, 135)
          .trigger("mouseup", 200, 135);

        drawToolTile.getRectangleDrawing().first().should("have.attr", "x").then(parseInt).and("within", 150, 250);

        // The best way I found to remove the hover was to delete the rectangle
        drawToolTile.getRectangleDrawing().first().click({force: true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getSelectionBox().should("not.exist");
      });
      it("verify draw squares", () => {
        drawToolTile.getDrawToolRectangle().click();

        // starting from top edge
        drawToolTile.getDrawTile()
          .trigger("mousedown", 100, 50, {ctrlKey: true})
          .trigger("mousemove", 100, 70,{ctrlKey: true})
          .trigger("mouseup",   100, 70);

        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "20");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "20");

        // starting from the left edge
        drawToolTile.getDrawTile()
          .trigger("mousedown", 200, 50, {ctrlKey: true})
          .trigger("mousemove", 230, 50,{ctrlKey: true})
          .trigger("mouseup",   230, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 2);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "30");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "30");

        // draw a square starting at the bottom edge
        drawToolTile.getDrawTile()
          .trigger("mousedown", 300, 90, {ctrlKey: true})
          .trigger("mousemove", 300, 50,{ctrlKey: true})
          .trigger("mouseup",   300, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 3);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "40");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "40");

        // draw a square starting at the right edge
        drawToolTile.getDrawTile()
          .trigger("mousedown", 450, 50, {ctrlKey: true})
          .trigger("mousemove", 400, 50,{ctrlKey: true})
          .trigger("mouseup",   400, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 4);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "50");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "50");

        // Diagonal from top right to bottom left with the width 60 and height 50
        drawToolTile.getDrawTile()
          .trigger("mousedown", 560, 50, {ctrlKey: true})
          .trigger("mousemove", 500, 100,{ctrlKey: true})
          .trigger("mouseup",   500, 100);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 5);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "60");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "60");

        // Diagonal from bottom right to top left with the width 50 and the height 70
        drawToolTile.getDrawTile()
          .trigger("mousedown", 650, 120, {ctrlKey: true})
          .trigger("mousemove", 600, 50,{ctrlKey: true})
          .trigger("mouseup",   600, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 6);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "70");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "70");

      });
      it("deletes rectangle drawings", () => {
        drawToolTile.getDrawTile().click();
        for (let i=0; i<6; i++) {
          drawToolTile.getDrawToolSelect().click();
          drawToolTile.getRectangleDrawing().first().click({force:true, scrollBehavior: false});
          drawToolTile.getDrawToolDelete().click();
        }
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
        drawToolTile.getEllipseDrawing().first().click({force:true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getEllipseDrawing().first().click({force:true, scrollBehavior: false});
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
        drawToolTile.getImageDrawing().click({force:true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getImageDrawing().should("not.exist");
      });
    });
    describe("Image", () => {
      it("drags images from image tiles", () => {
        const imageFilePath='image.png';
        clueCanvas.addTile('image');
        cy.uploadFile(imageToolTile.imageChooseFileButton(), imageFilePath, 'image/png');
        cy.wait(2000);
        // Doesn't seem like the image is actually loading into the image tile.
        // Once that's fixed, we should drag that image into the drawing tile.
      });
      it("uploads images", () => {
        const imageFilePath='image.png';
        cy.uploadFile(drawToolTile.getDrawToolUploadImage(), imageFilePath, 'image/png');
        cy.wait(2000);
        // Uploading images doesn't seem to be working at the moment.
        // drawToolTile.getImageDrawing().should("exist").and("have.length", 1);
      });
    });
  });
});
