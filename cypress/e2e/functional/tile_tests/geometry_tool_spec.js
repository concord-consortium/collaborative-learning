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

const problemDoc = '2.1 Drawing Wumps';
const ptsDoc = 'Points';

function beforeTest() {
  const queryParams = `${Cypress.config("queryParams")}`;
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.collapseResourceTabs();
}

context('Geometry Tool', function () {
  it('will test adding points to a geometry', function () {
    beforeTest();

    cy.log("add a point to the origin");
    clueCanvas.addTile('geometry');
    geometryToolTile.addPointToGraph(0, 0);
    geometryToolTile.getGraphPointCoordinates().should('exist');

    cy.log("add points to a geometry");
    canvas.createNewExtraDocumentFromFileMenu(ptsDoc, "my-work");
    clueCanvas.addTile('geometry');
    cy.get('.spacer').click();
    textToolTile.deleteTextTile();
    geometryToolTile.getGeometryTile().last().click();
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
  it('Geometry tile title restore upon page reload', () => {
    beforeTest();

    cy.log("edit tile title");
    const newName = "Graph Tile";
    clueCanvas.addTile('geometry');
    textToolTile.deleteTextTile();
    geometryToolTile.getGraphTitle().first().should("contain", "Shapes Graph 1");
    geometryToolTile.getGraphTileTitle().first().click();
    geometryToolTile.getGraphTileTitle().first().type(newName + '{enter}');
    geometryToolTile.getGraphTitle().should("contain", newName);
    cy.wait(2000);

    cy.reload();
    cy.waitForLoad();

    geometryToolTile.getGraphTitle().should("contain", newName);
  });
});
