import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import PrimaryWorkspace from '../../../support/elements/common/PrimaryWorkspace';
import ResourcePanel from '../../../support/elements/common/ResourcesPanel';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const geometryToolTile = new GeometryToolTile;
const primaryWorkspace = new PrimaryWorkspace;
const resourcePanel = new ResourcePanel;

const green  = "#19a90f";
const red   = "#ee0000";

const problemDoc = 'QA 1.1 Solving a Mystery with Proportional Reasoning';
const ptsDoc = 'Points';

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.collapseResourceTabs();
}

context('Geometry Tool', function () {
  it('will test basic geometry functions', function () {
    beforeTest();

    cy.log("add a point to the origin");
    clueCanvas.addTile('geometry');
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(0, 0);
    geometryToolTile.getGraphPointCoordinates().should('exist');

    cy.log("add points to a geometry");
    canvas.createNewExtraDocumentFromFileMenu(ptsDoc, "my-work");
    clueCanvas.addTile('geometry');
    cy.get('.spacer').click();
    geometryToolTile.getGeometryTile().last().click();
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(5, 5);
    geometryToolTile.clickGraphPosition(10, 5);
    geometryToolTile.clickGraphPosition(10, 10);

    cy.log("draw a point with the correct color");
    clueCanvas.clickToolbarButton('geometry', 'color');
    geometryToolTile.selectColor('red');
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(7, 7);
    geometryToolTile.getGraphPoint().last().should("have.attr", "fill", red);

    cy.log("select a point and change its color");
    geometryToolTile.selectGraphPoint(7, 7);
    clueCanvas.clickToolbarButton('geometry', 'color');
    geometryToolTile.selectColor('green');
    geometryToolTile.getGraphPoint().last().should("have.attr", "fill", green);

    cy.log("copy a point to the clipboard");
    let clipSpy;
    cy.window().then((win) => {
      clipSpy = cy.spy(win.navigator.clipboard, "write");
    });

    // platform test from hot-keys library
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const cmdKey = isMac ? "meta" : "ctrl";
    geometryToolTile.getGraphPoint().last().click({ force: true }).click({ force: true })
      .type(`{${cmdKey}+c}`, { force: true })
      .then(() => {
        expect(clipSpy.callCount).to.be.eq(1);
    });

    cy.log("restore points to canvas");
    primaryWorkspace.openResourceTab();
    resourcePanel.openPrimaryWorkspaceTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', problemDoc);
    geometryToolTile.getGraphPointCoordinates().should('exist');

    cy.log("verify restore of multiple points");
    cy.openDocumentWithTitle('my-work', 'workspaces', ptsDoc);
    geometryToolTile.getGraphPoint().should('have.length', 4);

    cy.log("select a point");
    let point = 4;
    cy.openDocumentWithTitle('my-work', 'workspaces', ptsDoc);
    cy.collapseResourceTabs();
    geometryToolTile.getGeometryTile().click({ multiple: true });
    geometryToolTile.selectGraphPoint(10, 10);
    geometryToolTile.getGraphPointID(point)
      .then((id) => {
        id = '#'.concat(id);
        cy.get(id).then(($el) => {
          expect($el).to.have.text('');
        });
      });

    const newName = "Graph Tile";
    geometryToolTile.getGraphTitle().first().should("contain", "Coordinate Grid 1");
    geometryToolTile.getGraphTileTitle().first().click();
    geometryToolTile.getGraphTileTitle().first().type(newName + '{enter}');
    geometryToolTile.getGraphTitle().should("contain", newName);
    cy.wait(2000);

    cy.log("verify geometry tile restore upon page reload");
    cy.reload();
    cy.waitForLoad();

    geometryToolTile.getGraphTitle().should("contain", newName);
    geometryToolTile.getGraphPoint().should('have.length', 4);

    // Zoom in and out, fit
    geometryToolTile.getGraphTileTitle().click();
    geometryToolTile.getGraphAxisTickLabels().last().should("have.text", "10");
    clueCanvas.clickToolbarButton('geometry', 'zoom-in');
    clueCanvas.clickToolbarButton('geometry', 'zoom-in');
    geometryToolTile.getGraphAxisTickLabels().last().should("have.text", "8");
    clueCanvas.clickToolbarButton('geometry', 'fit-all');
    geometryToolTile.getGraphAxisTickLabels().last().should("have.text", "10");
    clueCanvas.clickToolbarButton('geometry', 'zoom-out');
    clueCanvas.clickToolbarButton('geometry', 'zoom-out');
    geometryToolTile.getGraphAxisTickLabels().last().should("have.text", "15");
  });

  it('works in all four modes', () => {
    beforeTest();
    clueCanvas.addTile('geometry');
    geometryToolTile.getGraph().should("exist");

    cy.log("add points with points mode");
    clueCanvas.clickToolbarButton('geometry', 'point');
    clueCanvas.toolbarButtonIsSelected('geometry', 'point');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getPhantomGraphPoint().should("have.length", 1);
    geometryToolTile.clickGraphPosition(1, 1);
    geometryToolTile.clickGraphPosition(2, 2);
    geometryToolTile.getGraphPoint().should("have.length", 2);

    // Duplicate point
    geometryToolTile.selectGraphPoint(1, 1);
    clueCanvas.clickToolbarButton('geometry', 'duplicate');
    geometryToolTile.getGraph().trigger('mousemove'); // get phantom point back onto canvas after toolbar use
    geometryToolTile.getPhantomGraphPoint().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 3);

    // Delete point
    geometryToolTile.getGraphPoint().eq(2).click();
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getGraphPoint().should("have.length", 2);

    cy.log("select points with select mode");
    clueCanvas.clickToolbarButton('geometry', 'select');
    clueCanvas.toolbarButtonIsSelected('geometry', 'select');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getGraphPoint().should("have.length", 2);
    geometryToolTile.getPhantomGraphPoint().should("have.length", 0);

    // Clicking background should NOT create a point.
    geometryToolTile.clickGraphPosition(3, 3);
    geometryToolTile.getGraphPoint().should("have.length", 2); // same as before
    geometryToolTile.getPhantomGraphPoint().should("have.length", 0);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 0);

    // select one point
    geometryToolTile.selectGraphPoint(1, 1);
    geometryToolTile.getGraphPoint().eq(0).should("have.attr", "fill", "#0069ff"); // $data-blue
    geometryToolTile.getSelectedGraphPoint().should("have.length", 1);

    // set label options
    geometryToolTile.getGraphPointLabel().contains('A').should('not.exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.chooseLabelOption('label');
    geometryToolTile.getGraphPointLabel().contains('A').should('exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.chooseLabelOption('length');
    geometryToolTile.getGraphPointLabel().contains('A').should('not.exist');
    geometryToolTile.getGraphPointLabel().contains('1.00, 1.00').should('not.exist');

    // select a different point
    geometryToolTile.selectGraphPoint(2, 2);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 1);
    // use shift to select both points
    geometryToolTile.selectGraphPoint(1, 1, true);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 2);

    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPoint().should("have.length", 0);

    cy.log("make a polygon with polygon mode");
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    clueCanvas.toolbarButtonIsSelected('geometry', 'polygon');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getPhantomGraphPoint().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 0);
    geometryToolTile.clickGraphPosition(5, 5);
    geometryToolTile.getGraphPoint().should("have.length", 1);
    geometryToolTile.clickGraphPosition(10, 5);
    geometryToolTile.getGraphPoint().should("have.length", 2);
    geometryToolTile.clickGraphPosition(10, 10);
    geometryToolTile.getGraphPoint().should("have.length", 3);
    geometryToolTile.clickGraphPosition(5, 5); // click first point again to close polygon.
    geometryToolTile.getGraphPoint().should("have.length", 3);
    geometryToolTile.getGraphPolygon().should("have.length", 1);
    geometryToolTile.getPhantomGraphPoint().should("have.length", 1);

    // Create vertex angle
    cy.log('Create vertex angle');
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.getGraphPointLabel().contains('90°').should('not.exist');
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.selectGraphPoint(10, 5); // this point is a 90 degree angle
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.toggleAngleCheckbox();
    geometryToolTile.getGraphPointLabel().contains('90°').should('exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.toggleAngleCheckbox();
    geometryToolTile.getGraphPointLabel().contains('90°').should('not.exist');

    //Label the polygon
    cy.log('label the polygon');
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.getGraphPolygon().click(50, 50, { force: true,  });
    geometryToolTile.getSelectedGraphPoint().should('have.length', 3);
    geometryToolTile.getGraphPointLabel().contains('12.').should('not.exist');
    geometryToolTile.getGraphPointLabel().contains('ABC').should('not.exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.getModalTitle().should('include.text', 'Label');
    geometryToolTile.chooseLabelOption('length');
    geometryToolTile.getGraphPointLabel().contains('12.').should('exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.getModalLabelInput().should('have.value', 'ABC');
    geometryToolTile.chooseLabelOption('label');
    geometryToolTile.getGraphPointLabel().contains('12.').should('not.exist');
    geometryToolTile.getGraphPointLabel().contains('ABC').should('exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.chooseLabelOption('none');
    geometryToolTile.clickGraphPosition(0, 0); // deselect polygon

    // Label a segment
    cy.log('label a segment');
    geometryToolTile.getGraphPointLabel().contains('AB').should('not.exist');
    geometryToolTile.getGraphLine().should('have.length', 5); // 0-1 = axis lines, 2-4 = triangle
    geometryToolTile.getGraphLine().eq(4).click({ force: true });
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.getModalTitle().should('contain.text', 'Segment Label/Value');
    geometryToolTile.chooseLabelOption('label');
    geometryToolTile.getGraphPointLabel().contains('AB').should('exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.chooseLabelOption('length');
    geometryToolTile.getGraphPointLabel().contains('AB').should('not.exist');
    geometryToolTile.getGraphPointLabel().contains('5').should('exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.chooseLabelOption('none');
    geometryToolTile.getGraphPointLabel().contains('AB').should('not.exist');
    geometryToolTile.getGraphPointLabel().contains('5').should('not.exist');
    geometryToolTile.clickGraphPosition(0, 0); // deselect the segment

    // Test keyboard functions to move the selected point(s)
    cy.log('Test keyboard functions to move polygon points');

    // turn on 90 degree angle for check
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.selectGraphPoint(10, 5); // this point is a 90 degree angle
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.toggleAngleCheckbox();
    geometryToolTile.getGraphPointLabel().contains('90°').should('exist');

    // Select the graph point at (5, 5)
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(5, 5);

    // Verify that the point has been selected
    geometryToolTile.getSelectedGraphPoint().should('have.length', 1);

    // Store the original coordinates for comparison
    let originalXCoord, originalYCoord;
    geometryToolTile.getSelectedGraphPoint().then(($point) => {
      originalXCoord = parseFloat($point.attr('cx'));
      originalYCoord = parseFloat($point.attr('cy'));
    });

    // Move the selected point up using the arrow key
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(5, 5); // shared point
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 38 }); // simulate up arrow key press

    // Move the selected point right using the arrow key
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 39 }); // simulate right arrow key press

    // Verify that the point has moved: cx should be greater and cy should be less than the original values
    geometryToolTile.getSelectedGraphPoint().then(($point) => {
        const newXCoord = parseFloat($point.attr('cx'));
        const newYCoord = parseFloat($point.attr('cy'));

        expect(newXCoord).to.be.greaterThan(originalXCoord);
        expect(newYCoord).to.be.lessThan(originalYCoord);
    });

    // Also check that the angle label has changed from its original value
    geometryToolTile.getAngleAdornment().should(($label) => {
        const angleText = $label.text();
        expect(angleText).not.contains('90°'); // 90° was the original value
    });

    // Move the point back to the original position
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 37 }); // simulate left arrow key press
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 40 }); // simulate down arrow key press

    // Verify that the point has returned to its original coordinates
    geometryToolTile.getSelectedGraphPoint().then(($point) => {
        const newXCoord = parseFloat($point.attr('cx'));
        const newYCoord = parseFloat($point.attr('cy'));

        expect(newXCoord).to.equal(originalXCoord);
        expect(newYCoord).to.equal(originalYCoord);
    });

    // Verify that the angle label returns to its original value
    geometryToolTile.getGraphPointLabel().contains('90°').should('exist');

    // Turn off 90 degree angle label for check
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.selectGraphPoint(10, 5); // this point is a 90 degree angle
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.toggleAngleCheckbox();
    geometryToolTile.getGraphPointLabel().should('not.contain', '90°');

    // Change color of polygon
    geometryToolTile.selectGraphPoint(7, 6); // click middle of polygon to select it
    clueCanvas.clickToolbarButton('geometry', 'color');
    geometryToolTile.selectColor('green');
    geometryToolTile.getGraphPolygon().should("have.attr", "fill", green);

    // Duplicate polygon
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.selectGraphPoint(7, 6); // click middle of polygon to select it
    geometryToolTile.getSelectedGraphPoint().should("have.length", 3);
    clueCanvas.clickToolbarButton('geometry', 'duplicate');
    geometryToolTile.getGraphPolygon().should("have.length", 2);
    geometryToolTile.getGraphPoint().should("have.length", 6);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 0);

    // Delete polygon
    geometryToolTile.selectGraphPoint(7, 6);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 3);
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPolygon().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 3);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 0);

    geometryToolTile.selectGraphPoint(10, 5);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 3);
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPolygon().should("have.length", 0);
    geometryToolTile.getGraphPoint().should("have.length", 0);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 0);

    // Create first polygon from existing points
    cy.log('Create first polygon from existing points');
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(0, 0);
    geometryToolTile.clickGraphPosition(10, 0);
    geometryToolTile.clickGraphPosition(5, 5);
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    geometryToolTile.getGraphPoint().should("have.length", 3);
    geometryToolTile.getGraphPoint().eq(0).click();
    geometryToolTile.getGraphPoint().eq(1).click();
    geometryToolTile.getGraphPoint().eq(2).click();
    geometryToolTile.getGraphPoint().eq(0).click();
    geometryToolTile.getGraphPolygon().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 3);

    // Add a point to the existing polygon
    cy.log('Add a point to the existing polygon');
    geometryToolTile.clickGraphPosition(10, 0); // Reuse existing point
    geometryToolTile.clickGraphPosition(15, 5);
    geometryToolTile.clickGraphPosition(5, 5); // Reuse existing point
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    // check number of points
    geometryToolTile.getGraphPoint().should("have.length", 4);

    // Verify the polygon count is still 1
    geometryToolTile.getGraphPolygon().should("have.length", 1);

    // Create a second polygon that shares the same points as the first
    cy.log('Create a second polygon that shares a point with the first');
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    geometryToolTile.clickGraphPosition(15, 10); // new point
    geometryToolTile.clickGraphPosition(15, 5); // shared point
    geometryToolTile.clickGraphPosition(20, 5); // new point
    geometryToolTile.clickGraphPosition(15, 10); // close the polygon

    // Point should be shared
    geometryToolTile.getGraphPoint().should("have.length", 6); // New point added

    // Store the original point coordinates for comparison
    let originalCx, originalCy;
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(15, 5); // shared point
    geometryToolTile.getSelectedGraphPoint().then(($point) => {
      originalCx = parseFloat($point.attr('cx'));
      originalCy = parseFloat($point.attr('cy'));
      cy.wrap(originalCx).as('originalCx');
      cy.wrap(originalCy).as('originalCy');
    });

    // Add length labels to two line segments
    // Select line segments by clicking between two points
    geometryToolTile.clickGraphPosition(7.5, 5); // Middle of the first segment between (5, 5) and (10, 5)
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.getModalTitle().should('contain.text', 'Length');
    geometryToolTile.chooseLabelOption('length');

    geometryToolTile.clickGraphPosition(15, 7.5); // Middle of the second segment between (15, 5) and (15, 10)
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.getModalTitle().should('contain.text', 'Length');
    geometryToolTile.chooseLabelOption('length');
    geometryToolTile.clickGraphPosition(0, 0); // deselect

    // Verify that the two line segments were created
    geometryToolTile.getGraphPointLabel().contains('10.0').should('exist');
    geometryToolTile.getGraphPointLabel().contains('5.0').should('exist');

    // Move the point
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(15, 5); // shared point
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 39 }); // simulate right arrow key press
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 38 }); // simulate up arrow key press

    // Verify that the point values changed
    geometryToolTile.getSelectedGraphPoint().then(($point) => {
      const newPx = parseFloat($point.attr('cx')); // 'px' for point x-coordinate
      const newPy = parseFloat($point.attr('cy')); // 'py' for point y-coordinate

      expect(newPx).to.be.greaterThan(originalCx);
      expect(newPy).to.be.lessThan(originalCy);
    });

    // Verify that the two line segments have changed
    geometryToolTile.getGraphPointLabel().contains('10.1').should('exist');
    geometryToolTile.getGraphPointLabel().contains('4.9').should('exist');

    // Move the point back to the original position
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 37 }); // simulate left arrow key press
    geometryToolTile.getSelectedGraphPoint().trigger('keydown', { keyCode: 40 }); // simulate down arrow key press

    // Verify that the point has returned to its original coordinates
    geometryToolTile.getSelectedGraphPoint().then(($point) => {
      const resetPx = parseFloat($point.attr('cx'));
      const resetPy = parseFloat($point.attr('cy'));

      expect(resetPx).to.equal(originalCx);
      expect(resetPy).to.equal(originalCy);
    });

    // Verify that the two line segments returned to their original values
    geometryToolTile.getGraphPointLabel().contains('10.0').should('exist');
    geometryToolTile.getGraphPointLabel().contains('5.0').should('exist');

    // Verify the point is still shared
    geometryToolTile.getGraphPoint().should("have.length", 6); // New point added

    // Delete the first polygon
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(5, 3); //click inside the polygon
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPolygon().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 3);

    // Delete the second
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(17, 7); // click inside the polygon
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPolygon().should("have.length", 0);
    geometryToolTile.getGraphPoint().should("have.length", 0);

    // Create polygon from existing points
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(0, 0);
    geometryToolTile.clickGraphPosition(10, 0);
    geometryToolTile.clickGraphPosition(5, 5);
    clueCanvas.clickToolbarButton('geometry', 'polygon');
    geometryToolTile.getGraphPoint().should("have.length", 3);
    geometryToolTile.getGraphPoint().eq(0).click();
    geometryToolTile.getGraphPoint().eq(1).click();
    geometryToolTile.getGraphPoint().eq(2).click();
    geometryToolTile.getGraphPoint().eq(0).click();
    geometryToolTile.getGraphPolygon().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 3);
    // Delete it
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(5, 3);
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphPolygon().should("have.length", 0);
    geometryToolTile.getGraphPoint().should("have.length", 0);

    // Create a circle
    clueCanvas.clickToolbarButton('geometry', 'circle');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getPhantomGraphPoint().should("have.length", 1);
    geometryToolTile.clickGraphPosition(5, 5);
    geometryToolTile.clickGraphPosition(10, 5);
    geometryToolTile.getGraphCircle().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 2);

    // Click outside circle to deselect
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.clickGraphPosition(10, 10);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 0);
    // Click inside circle to select
    geometryToolTile.selectGraphPoint(7, 7);
    geometryToolTile.getSelectedGraphPoint().should("have.length", 2);

    // Change color of circle
    clueCanvas.clickToolbarButton('geometry', 'color');
    geometryToolTile.selectColor('red');
    geometryToolTile.getSelectedGraphCircle().should("have.attr", "fill", red);

    // Delete circle
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphCircle().should("have.length", 0);
    geometryToolTile.getGraphPoint().should("have.length", 0);

    // Create a circle from existing points
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.clickGraphPosition(0, 5);
    geometryToolTile.clickGraphPosition(0, 10);
    clueCanvas.clickToolbarButton('geometry', 'circle');
    geometryToolTile.getGraphPoint().should("have.length", 2);
    geometryToolTile.getGraphPoint().eq(1).click();
    geometryToolTile.getGraphPoint().eq(0).click();
    geometryToolTile.getGraphCircle().should("have.length", 1);
    geometryToolTile.getGraphPoint().should("have.length", 2);
    // Delete it by deleting one point
    geometryToolTile.selectGraphPoint(0, 10);
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraphCircle().should("have.length", 0);
    geometryToolTile.getGraphPoint().should("have.length", 1);
    geometryToolTile.getGraphPolygon().should("have.length", 0);
  });

  it('will test Geometry tile undo redo', () => {
    beforeTest();

    cy.log("undo redo geometry tile creation/deletion");
    // Creation - Undo/Redo
    clueCanvas.addTile('geometry');
    geometryToolTile.getGraph().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGraph().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGraph().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    // Deletion - Undo/Redo
    clueCanvas.deleteTile('geometry');
    geometryToolTile.getGraph().should("not.exist");
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGraph().should("exist");
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGraph().should("not.exist");
    clueCanvas.getUndoTool().click();

    cy.log("edit tile title");
    const newName = "Graph Tile";
    geometryToolTile.getGraphTitle().first().should("contain", "Coordinate Grid 1");
    geometryToolTile.getGraphTileTitle().first().click();
    geometryToolTile.getGraphTileTitle().first().type(newName + '{enter}');
    geometryToolTile.getGraphTitle().should("contain", newName);

    cy.log("undo redo actions");
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGraphTitle().first().should("contain", "Coordinate Grid 1");
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGraphTitle().should("contain", "Graph Tile");

    cy.log("verify delete geometry");
    clueCanvas.deleteTile('geometry');
    geometryToolTile.getGraph().should("not.exist");
  });
});
