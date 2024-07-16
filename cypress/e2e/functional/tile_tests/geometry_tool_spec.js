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

const problemDoc = 'QA 1.1 Solving a Mystery with Proportional Reasoning';
const ptsDoc = 'Points';

function beforeTest() {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`;
  cy.clearQAData('all');
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
    geometryToolTile.getGraphPoint().should('have.length', 3);

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
    geometryToolTile.getGraphTitle().first().should("contain", "Shapes Graph 1");
    geometryToolTile.getGraphTileTitle().first().click();
    geometryToolTile.getGraphTileTitle().first().type(newName + '{enter}');
    geometryToolTile.getGraphTitle().should("contain", newName);
    cy.wait(2000);

    cy.log("verify geometry tile restore upon page reload");
    cy.reload();
    cy.waitForLoad();

    geometryToolTile.getGraphTitle().should("contain", newName);
    geometryToolTile.getGraphPoint().should('have.length', 3);

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
    geometryToolTile.getGraphPointLabel().contains('90°').should('not.exist');
    clueCanvas.clickToolbarButton('geometry', 'select');
    geometryToolTile.selectGraphPoint(10, 5); // this point is a 90 degree angle
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.toggleAngleCheckbox();
    geometryToolTile.getGraphPointLabel().contains('90°').should('exist');

    // Label the polygon
    geometryToolTile.getGraphPolygon().click(50, 50, { force: true,  });
    geometryToolTile.getSelectedGraphPoint().should('have.length', 3);
    geometryToolTile.getGraphPointLabel().contains('12.').should('not.exist');
    geometryToolTile.getGraphPointLabel().contains('ABC').should('not.exist');
    clueCanvas.clickToolbarButton('geometry', 'label');
    geometryToolTile.getModalTitle().should('contain.text', 'Polygon Label/Value');
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
    geometryToolTile.getGraphTitle().first().should("contain", "Shapes Graph 1");
    geometryToolTile.getGraphTileTitle().first().click();
    geometryToolTile.getGraphTileTitle().first().type(newName + '{enter}');
    geometryToolTile.getGraphTitle().should("contain", newName);

    cy.log("undo redo actions");
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGraphTitle().first().should("contain", "Shapes Graph 1");
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGraphTitle().should("contain", "Graph Tile");

    cy.log("verify delete geometry");
    clueCanvas.deleteTile('geometry');
    geometryToolTile.getGraph().should("not.exist");
  });
});
