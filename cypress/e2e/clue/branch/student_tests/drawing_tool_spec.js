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
    cy.showOnlyDocumentWorkspace();
  });
  describe("Draw Tool", () => {
    it("renders draw tool tile", () => {
      clueCanvas.addTile("drawing");
      drawToolTile.getDrawTile().should("exist");
      drawToolTile.getTileTitle().should("exist");
    });
    describe("Freehand", () => {
      it("verify draw a line", () => {
        drawToolTile.getDrawToolFreehand().click({scrollBehavior: false});
        drawToolTile.getDrawTile()
          .trigger("mousedown", 350, 50)
          .trigger("mousemove", 350, 100)
          .trigger("mousemove", 450, 100)
          .trigger("mouseup",   450, 100);
        drawToolTile.getFreehandDrawing().should("exist").and("have.length", 1);
      });
      it("selects freehand drawing", () => {
        drawToolTile.getDrawToolSelect().click({scrollBehavior: false});
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
      it("verify change outline color", () => {
        drawToolTile.getDrawToolStrokeColor().click({scrollBehavior: false});
        cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").eq(1).click({scrollBehavior: false});
        drawToolTile.getFreehandDrawing().first().should("have.attr", "stroke").and("eq", "#eb0000");
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
        drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click({scrollBehavior: false});
        drawToolTile.getFreehandDrawing().should("not.exist");
      });
    });
    describe("Vector", () => {
      it("verify draw vector", () => {
        drawToolTile.getDrawToolVector().click({scrollBehavior: false});
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 50)
          .trigger("mousemove", 100, 50)
          .trigger("mouseup",   100, 50);
        drawToolTile.getVectorDrawing().should("exist").and("have.length", 1);
      });
      it("verify after creation, object is selected", () => {
        drawToolTile.getDrawToolSelect().should("have.class", "selected");
        drawToolTile.getDrawToolVector().should("not.have.class", "selected");
        drawToolTile.getSelectionBox().should("exist");
        drawToolTile.getDrawToolDelete().should("not.have.class", "disabled");
      });
      it("verify change outline color", () => {
        drawToolTile.getDrawToolStrokeColor().click({scrollBehavior: false});
        cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").eq(2).click({scrollBehavior: false});
        drawToolTile.getVectorDrawing().first().should("have.attr", "stroke").and("eq", "#008a00");
        drawToolTile.getDrawToolStrokeColor().click({scrollBehavior: false});
        cy.get(".toolbar-palette.stroke-color .palette-buttons").should("be.visible");
        cy.get(".toolbar-palette.stroke-color .palette-buttons .color-swatch").first().click({scrollBehavior: false});
      });
      it("change line to arrow", () => {
        drawToolTile.getVectorDrawing().children().its("length").should("eq", 1); // Only a line, no arrowheads yet.
        drawToolTile.getDrawToolVectorSubmenu().click({scrollBehavior: false});
        cy.get(".toolbar-palette.vectors .drawing-tool-buttons").should("be.visible");
        cy.get(".toolbar-palette.vectors .drawing-tool-buttons div:nth-child(3) button").click({scrollBehavior: false});
        drawToolTile.getVectorDrawing().children().its("length").should("eq", 3); // Now three items in group...
        drawToolTile.getVectorDrawing().find("polygon").its("length").should("eq", 2); // including two arrowheads.
        // selecting from this submenu activates the vector tool, which de-selects the object.
        });
      it("deletes vector drawing", () => {
        // re-select the object using a selection rectangle.
        drawToolTile.getDrawToolSelect().click({scrollBehavior: false});
        drawToolTile.getDrawTile()
          .trigger("mousedown", 90, 40)
          .trigger("mousemove", 260, 60)
          .trigger("mouseup",   260, 60);
        drawToolTile.getDrawToolDelete().click({scrollBehavior: false});
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
        drawToolTile.getSelectionBox().should("exist");

        // Unselect the rectangle just drawn
        drawToolTile.getDrawTile()
          // Un-select the rectangle
          .trigger("mousedown", 500, 100)
          .trigger("mouseup", 500, 100);
        drawToolTile.getSelectionBox().should("not.exist");

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
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getRectangleDrawing().should("not.exist");
        drawToolTile.getSelectionBox().should("not.exist");
      });
      it("verify draw squares", () => {

        // starting from top edge
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 100, 50, {altKey: true})
          .trigger("mousemove", 100, 70, {altKey: true})
          .trigger("mouseup",   100, 70);

        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 1);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "20");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "20");

        // starting from the left edge
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 200, 50, {altKey: true})
          .trigger("mousemove", 230, 50, {altKey: true})
          .trigger("mouseup",   230, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 2);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "30");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "30");

        // draw a square starting at the bottom edge
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 300, 90, {altKey: true})
          .trigger("mousemove", 300, 50, {altKey: true})
          .trigger("mouseup",   300, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 3);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "40");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "40");

        // draw a square starting at the right edge
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 450, 50, {altKey: true})
          .trigger("mousemove", 400, 50, {altKey: true})
          .trigger("mouseup",   400, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 4);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "50");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "50");

        // Diagonal from top right to bottom left with the width 60 and height 50
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 560, 50,  {altKey: true})
          .trigger("mousemove", 500, 100, {altKey: true})
          .trigger("mouseup",   500, 100);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 5);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "60");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "60");

        // Diagonal from bottom right to top left with the width 50 and the height 70
        drawToolTile.getDrawToolRectangle().click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 650, 120, {altKey: true})
          .trigger("mousemove", 600, 50,  {altKey: true})
          .trigger("mouseup",   600, 50);
        drawToolTile.getRectangleDrawing().should("exist").and("have.length", 6);
        drawToolTile.getRectangleDrawing().last().should("have.attr", "width").and("eq", "70");
        drawToolTile.getRectangleDrawing().last().should("have.attr", "height").and("eq", "70");

      });
      it("deletes rectangle drawings", () => {
        drawToolTile.getDrawTile().click();
        // delete the first 4 with the toolbar button
        for (let i=0; i<4; i++) {
          drawToolTile.getDrawToolSelect().click();
          drawToolTile.getRectangleDrawing().first().click({force:true, scrollBehavior: false});
          drawToolTile.getDrawToolDelete().click();
        }
        // Delete with backspace key
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().first().click({force:true, scrollBehavior: false});
        drawToolTile.getDrawTileComponent().type("{backspace}");

        // Delete with delete key
        drawToolTile.getDrawToolSelect().click();
        drawToolTile.getRectangleDrawing().first().click({force:true, scrollBehavior: false});
        drawToolTile.getDrawTileComponent().type("{del}");

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
          .trigger("mousedown", 450,  50, {altKey: true})
          .trigger("mousemove", 450, 150, {altKey: true})
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
      it("verify stamp images", () => {
        drawToolTile.getImageDrawing().eq(0).should("have.attr", "href").and("contain", "coin.png");
        drawToolTile.getDrawToolStampExpand().click();
        cy.get(".toolbar-palette.stamps .palette-buttons .stamp-button").eq(1).click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 100)
          .trigger("mouseup");
        drawToolTile.getImageDrawing().should("exist").and("have.length", 2);
        drawToolTile.getImageDrawing().eq(1).should("have.attr", "href").and("contain", "pouch.png");
        drawToolTile.getDrawToolStampExpand().click();
        cy.get(".toolbar-palette.stamps .palette-buttons .stamp-button").eq(2).click();
        drawToolTile.getDrawTile()
          .trigger("mousedown", 250, 150)
          .trigger("mouseup");
        drawToolTile.getImageDrawing().should("exist").and("have.length", 3);
        drawToolTile.getImageDrawing().eq(2).should("have.attr", "href").and("contain", "plus.png");
      });
      it("deletes stamp drawing", () => {
        drawToolTile.getDrawToolSelect().click();
        // drawToolTile.getImageDrawing().click({force:true, scrollBehavior: false});
        drawToolTile.getImageDrawing().eq(0).click({force:true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getImageDrawing().eq(1).click({force:true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getImageDrawing().click({force:true, scrollBehavior: false});
        drawToolTile.getDrawToolDelete().click();
        drawToolTile.getImageDrawing().should("not.exist");
      });
    });
    describe("Text", () => {
      it("adds text object", () => {
        drawToolTile.getDrawToolText().click({scrollBehavior: false});
        drawToolTile.getDrawTile()
          .trigger("mousedown", 100,  100)
          .trigger("mouseup", 100, 100);
          drawToolTile.getTextDrawing().should("exist").and("have.length", 1);
      });
      it("edits text content of object", () => {
        // Click inside drawing box to enter edit mode
        drawToolTile.getDrawTile()
          .trigger("mousedown", 150,  150)
          .trigger("mouseup", 150, 150);
          drawToolTile.getTextDrawing().get('textarea').type("The five boxing wizards jump quickly.{enter}", {scrollBehavior: false});
          drawToolTile.getTextDrawing().get('text tspan').should("exist").and("have.length", 6);
      });
      it("deletes text object", () => {
        drawToolTile.getDrawToolSelect().click({scrollBehavior: false});
        drawToolTile.getDrawTile()
          .trigger("mousedown", 150,  150)
          .trigger("mouseup", 150, 150);
          cy.wait(2000);
        drawToolTile.getSelectionBox().should("exist");
        drawToolTile.getDrawToolDelete().should("not.have.class", "disabled").click({scrollBehavior: false});
        drawToolTile.getTextDrawing().should("not.exist");
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
      // TODO: Figure out how to get the clipboard paste check below to work when the tests
      // are run using Chrome. It will pass when using Electron, but not Chrome. In Chrome
      // the attempt to write to the clipboard results in an error: "Must be handling a user
      // gesture to use custom clipboard." See https://github.com/cypress-io/cypress/issues/2752
      // for more background. Apparently, the basic problem is that Cypress "currently uses
      // programmatic browser APIs which Chrome doesn't consider as genuine user interaction."
      it.skip('will accept a valid image URL pasted from the clipboard', function(){
        // For the drawing tool, this path needs to correspond to an actual file in the curriculum repository.
        const imageFilePath = "curriculum/sas/images/survey.png";
        Cypress.automation("remote:debugger:protocol", {
          command: "Browser.grantPermissions",
          params: {
            permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
            origin: window.location.origin,
          },
        }).then(cy.window().then((win) => {
          win.navigator.clipboard.write([new win.ClipboardItem({
              "text/plain": new Blob([imageFilePath], { type: "text/plain" }),
          })]);
        }));
        const isMac = navigator.platform.indexOf("Mac") === 0;
        const cmdKey = isMac ? "meta" : "ctrl";
        drawToolTile.getDrawTileComponent().last().type(`{${cmdKey}+v}`);
        drawToolTile.getImageDrawing().last().should("exist").invoke("attr", "href").should("contain", "sas/images/survey.png");
      });
    });
  });
});

context('Draw Tool Tile Undo Redo', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=msa";
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.showOnlyDocumentWorkspace();
  });
  describe("Drawing tile title edit, undo redo and delete tile", () => {
    it('will undo redo drawing tile creation/deletion', function () {
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
    });
    it("edit tile title", () => {
      const newName = "Drawing Tile";
      clueCanvas.addTile("drawing");
      drawToolTile.getDrawTile().should("exist");
      drawToolTile.getTileTitle().should("exist");
      drawToolTile.getTileTitle().first().should("contain", "Drawing 1");
      drawToolTile.getDrawTileTitle().first().click();
      drawToolTile.getDrawTileTitle().first().type(newName + '{enter}');
      drawToolTile.getTileTitle().should("contain", newName);
  });
  it("undo redo actions", () => {
      clueCanvas.getUndoTool().click();
      drawToolTile.getTileTitle().first().should("contain", "Drawing 1");
      clueCanvas.getUndoTool().click();
      drawToolTile.getDrawTile().should("not.exist");
      clueCanvas.getRedoTool().click().click();
      drawToolTile.getTileTitle().should("contain", "Drawing Tile");
  });
  it('verify delete tile', function () {
      clueCanvas.deleteTile('draw');
      drawToolTile.getDrawTile().should("not.exist");
  });
  });
});
