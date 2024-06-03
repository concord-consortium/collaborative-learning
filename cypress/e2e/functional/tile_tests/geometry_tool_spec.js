import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import PrimaryWorkspace from '../../../support/elements/common/PrimaryWorkspace';
import ResourcePanel from '../../../support/elements/common/ResourcesPanel';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const geometryToolTile = new GeometryToolTile;
const primaryWorkspace = new PrimaryWorkspace;
const resourcePanel = new ResourcePanel;
const textToolTile = new TextToolTile;

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
    geometryToolTile.addPointToGraph(0, 0);
    geometryToolTile.getGraphPointCoordinates().should('exist');

    cy.log("add points to a geometry");
    canvas.createNewExtraDocumentFromFileMenu(ptsDoc, "my-work");
    clueCanvas.addTile('geometry');
    cy.get('.spacer').click();
    textToolTile.deleteTextTile();
    geometryToolTile.getGeometryTile().last().click();
    clueCanvas.clickToolbarButton('geometry', 'point');
    geometryToolTile.addPointToGraph(5, 5);
    geometryToolTile.addPointToGraph(10, 5);
    geometryToolTile.addPointToGraph(10, 10);

    cy.log("copy a point to the clipboard");
    let clipSpy;
    cy.window().then((win) => {
      clipSpy = cy.spy(win.navigator.clipboard, "write");
    });

    // platform test from hot-keys library
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const cmdKey = isMac ? "meta" : "ctrl";
    geometryToolTile.getGraphPoint().last().click({ force: true }).click({ force: true })
      .type(`{${cmdKey}+c}`)
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

  it('works in all three modes', () => {
    beforeTest();
    clueCanvas.addTile('geometry');
    geometryToolTile.getGraph().should("exist");

    cy.log("add points with points mode");
    clueCanvas.clickToolbarButton('geometry', 'point');
    clueCanvas.toolbarButtonIsSelected('geometry', 'point');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getGraphPoint().should("have.length", 1); // phantom point
    geometryToolTile.addPointToGraph(1, 1);
    geometryToolTile.addPointToGraph(2, 2);
    geometryToolTile.getGraphPoint().should("have.length", 3);

    // Duplicate point
    geometryToolTile.selectGraphPoint(1, 1);
    clueCanvas.clickToolbarButton('geometry', 'duplicate');
    geometryToolTile.getGraph().trigger('mousemove'); // get phantom point back onto canvas after toolbar use
    geometryToolTile.getGraphPoint().should("have.length", 4);

    // Delete point
    geometryToolTile.getGraphPoint().eq(2).click();
    clueCanvas.clickToolbarButton('geometry', 'delete');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getGraphPoint().should("have.length", 3);

    cy.log("select points with select mode");
    clueCanvas.clickToolbarButton('geometry', 'select');
    clueCanvas.toolbarButtonIsSelected('geometry', 'select');
    geometryToolTile.getGraph().trigger('mousemove');
    geometryToolTile.getGraphPoint().should("have.length", 2); // no phantom point

    // Clicking background should NOT create a point.
    geometryToolTile.addPointToGraph(3, 3);
    geometryToolTile.getGraphPoint().should("have.length", 2); // same as before

    geometryToolTile.getSelectedGraphPoint().should("have.length", 0);

    // select one point
    geometryToolTile.selectGraphPoint(1, 1);
    geometryToolTile.getGraphPoint().eq(0).should("have.attr", "fill", "#ff0000");
    geometryToolTile.getSelectedGraphPoint().should("have.length", 1);
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
    geometryToolTile.getGraphPoint().should("have.length", 1); // phantom point
    geometryToolTile.addPointToGraph(5, 5);
    geometryToolTile.getGraphPoint().should("have.length", 2);
    geometryToolTile.addPointToGraph(10, 5);
    geometryToolTile.getGraphPoint().should("have.length", 3);
    geometryToolTile.addPointToGraph(9, 9);
    geometryToolTile.getGraphPoint().should("have.length", 4);
    geometryToolTile.addPointToGraph(5, 5); // click first point again to close polygon.
    geometryToolTile.getGraphPoint().should("have.length", 4);
    geometryToolTile.getGraphPolygon().should("have.length", 1);

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
  });

  it('will test Geometry tile undo redo', () => {
    beforeTest();

    cy.log("undo redo geometry tile creation/deletion");
    // Creation - Undo/Redo
    clueCanvas.addTile('geometry');
    geometryToolTile.getGraph().should("exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGraph().should("exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    // Deletion - Undo/Redo
    clueCanvas.deleteTile('geometry');
    geometryToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().click();
    geometryToolTile.getGraph().should("exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getRedoTool().click();
    geometryToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("exist");
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
    textToolTile.getTextTile().should("exist");
  });
});
