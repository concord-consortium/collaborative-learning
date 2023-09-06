import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import PrimaryWorkspace from '../../../../support/elements/common/PrimaryWorkspace';
import ResourcePanel from '../../../../support/elements/clue/ResourcesPanel';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const primaryWorkspace = new PrimaryWorkspace;
const resourcePanel = new ResourcePanel;
const textToolTile = new TextToolTile;

const problemDoc = '2.1 Drawing Wumps';
const ptsDoc = 'Points';

context('Graph Tool', function () {
  beforeEach(function () {
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    cy.collapseResourceTabs();
  });

  it('will test adding points to a graph', function () {
    cy.log("add a point to the origin");
    clueCanvas.addTile('geometry');
    graphToolTile.addPointToGraph(0, 0);
    graphToolTile.getGraphPointCoordinates().should('exist');
    
    cy.log("add points to a graph");
    canvas.createNewExtraDocumentFromFileMenu(ptsDoc, "my-work");
    clueCanvas.addTile('geometry');
    cy.get('.spacer').click();
    textToolTile.deleteTextTile();
    graphToolTile.getGraphTile().last().click();
    graphToolTile.addPointToGraph(5, 5);
    graphToolTile.addPointToGraph(10, 5);
    graphToolTile.addPointToGraph(10, 10);
    
    cy.log("copy a point to the clipboard");
    let clipSpy;
    cy.window().then((win) => {
      clipSpy = cy.spy(win.navigator.clipboard, "write");
    });

    // platform test from hot-keys library
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const cmdKey = isMac ? "meta" : "ctrl";
    graphToolTile.getGraphPoint().last().click({ force: true }).click({ force: true })
      .type(`{${cmdKey}+c}`)
      .then(() => {
        expect(clipSpy.callCount).to.be.eq(1);
    });
    
    cy.log("restore points to canvas");
    primaryWorkspace.openResourceTab();
    resourcePanel.openPrimaryWorkspaceTab("my-work");
    cy.openDocumentWithTitle('my-work', 'workspaces', problemDoc);
    graphToolTile.getGraphPointCoordinates().should('exist');
    
    cy.log("verify restore of multiple points");
    cy.openDocumentWithTitle('my-work', 'workspaces', ptsDoc);
    graphToolTile.getGraphPoint().should('have.length', 3);
    
    cy.log("select a point");
    let point = 4;
    cy.openDocumentWithTitle('my-work', 'workspaces', ptsDoc);
    cy.collapseResourceTabs();
    graphToolTile.getGraphTile().click({ multiple: true });
    graphToolTile.selectGraphPoint(10, 10);
    graphToolTile.getGraphPointID(point)
      .then((id) => {
        id = '#'.concat(id);
        cy.get(id).then(($el) => {
          expect($el).to.have.text('');
        });
      });
  });

  it('will test Graph tile undo redo', () => {
    cy.log("undo redo graph tile creation/deletion");
    // Creation - Undo/Redo
    clueCanvas.addTile('geometry');
    graphToolTile.getGraph().should("exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    clueCanvas.getUndoTool().click();
    graphToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("not.exist");
    clueCanvas.getUndoTool().should("have.class", "disabled");
    clueCanvas.getRedoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().click();
    graphToolTile.getGraph().should("exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().should("not.have.class", "disabled");
    clueCanvas.getRedoTool().should("have.class", "disabled");
    // Deletion - Undo/Redo
    clueCanvas.deleteTile('geometry');
    graphToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().click();
    graphToolTile.getGraph().should("exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getRedoTool().click();
    graphToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("exist");
    clueCanvas.getUndoTool().click();
  
    cy.log("edit tile title");
    const newName = "Graph Tile";
    graphToolTile.getGraphTitle().first().should("contain", "Graph 1");
    graphToolTile.getGraphTileTitle().first().click();
    graphToolTile.getGraphTileTitle().first().type(newName + '{enter}');
    graphToolTile.getGraphTitle().should("contain", newName);
    
    cy.log("undo redo actions");
    clueCanvas.getUndoTool().click();
    graphToolTile.getGraphTitle().first().should("contain", "Graph 1");
    clueCanvas.getRedoTool().click();
    graphToolTile.getGraphTitle().should("contain", "Graph Tile");
  
    cy.log("verify delete graph");
    clueCanvas.deleteTile('geometry');
    graphToolTile.getGraph().should("not.exist");
    textToolTile.getTextTile().should("exist");
  });
});
