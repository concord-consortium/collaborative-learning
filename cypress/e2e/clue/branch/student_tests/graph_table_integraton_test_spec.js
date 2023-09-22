import ResourcesPanel from '../../../../support/elements/clue/ResourcesPanel';
import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';
import TextToolTile from '../../../../support/elements/clue/TextToolTile';

let resourcesPanel = new ResourcesPanel;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const tableToolTile = new TableToolTile;
const textToolTile = new TextToolTile;

const x = ['3', '7', '6', '0'];
const y = ['2.5', '5', '1', '0'];

context('Graph Table Integration', function () {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&problem=2.3&qaGroup=5"; //using different problem bec. 2.1 disables graph table integration
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.collapseResourceTabs();

    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
  });

  context('Tests for graph and table integration', function () {
    before(function () {
      clueCanvas.addTile('table');
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getTableCell().eq(1).click().type(x[0] +'{enter}');
        tableToolTile.getTableCell().eq(2).click();
        tableToolTile.getTableCell().eq(2).type(y[0] +'{enter}');
        tableToolTile.getTableCell().eq(5).click();
        tableToolTile.getTableCell().eq(5).type(x[1] + '{enter}');
        tableToolTile.getTableCell().eq(6).click();
        cy.wait(500);
        tableToolTile.getTableCell().eq(6).type(y[1] + '{enter}');
        tableToolTile.getTableCell().eq(9).click();
        tableToolTile.getTableCell().eq(9).type(x[2] + '{enter}');
        tableToolTile.getTableCell().eq(10).click();
        tableToolTile.getTableCell().eq(10).type(y[2] + '{enter}');
        tableToolTile.getTableCell().eq(13).click();
        tableToolTile.getTableCell().eq(13).type(x[3] + '{enter}');
        tableToolTile.getTableCell().eq(14).click();
        tableToolTile.getTableCell().eq(14).type(y[3] + '{enter}');
        tableToolTile.getTableCell().eq(17).click();
      });
      clueCanvas.addTile('geometry');
      textToolTile.deleteTextTile();
    });
    describe('Link graph dialog', () => {
      it('verify correct graph names appear in selection list', function () {
        tableToolTile.getTableTile().click();
        cy.get('.primary-workspace .link-tile-button').click();
        cy.wait(2000);
        // cy.get('[data-test=link-tile-select]').select('Second One');
        cy.get('[data-test=link-tile-select]').select('Graph 1');
      });
      after(function () {
        cy.get('.ReactModalPortal button').contains('Cancel').click();
      });
    });
    describe("connect and disconnect table and graph after coordinates have been added", function () {
      it('verify link icon appears when table and graph are connected', function () {
        cy.get(clueCanvas.linkIconEl()).should('not.exist');
        cy.linkTableToGraph('Table 1', "Graph 1");
        tableToolTile.getTableTile().scrollIntoView();
        graphToolTile.getGraphTile().siblings(clueCanvas.linkIconEl()).should('exist');
        // verifies that values exported from .scss file were successfully imported
        graphToolTile.getGraphTile().siblings(clueCanvas.linkIconEl()).children('svg').attribute('data-indicator-width').should('exist');
        graphToolTile.getGraph().should('have.class', 'is-linked');
      });
      it('verify points added has label in table and graph', function () {
        tableToolTile.getIndexNumberToggle().should('exist').click({ force: true });
        tableToolTile.getTableIndexColumnCell().first().should('contain', '1');
        graphToolTile.getGraphPointLabel().contains('A').should('exist');
        graphToolTile.getGraphPointLabel().contains('B').should('exist');
        graphToolTile.getGraphPointLabel().contains('C').should('exist');
        graphToolTile.getGraphPointLabel().contains('D').should('exist');
      });
      it('verify table can be linked to two graphs', function () {
        clueCanvas.addTile('geometry');
        cy.linkTableToGraph('Table 1', "Graph 2");
        graphToolTile.getGraphTile().siblings(clueCanvas.linkIconEl()).should('have.length', 2);
      });
      it('verify unlink of graph and table', function () {
        cy.unlinkTableToGraph('Table 1', "Graph 2");
        graphToolTile.getGraphTile().siblings(clueCanvas.linkIconEl()).should('have.length', 1);
        graphToolTile.getGraph().last().should('not.have.class', 'is-linked');
      });
      it('verify point no longer has p1 in table and graph', function () {
        graphToolTile.getGraphPointLabel().contains('A').should('have.length', 1);
      });
      after(function () {
        clueCanvas.deleteTile('graph');
      });
    });
    describe.skip('test creating a polygon', function () {
      it('will create a polygon', function () {
        graphToolTile.getGraphPoint().last().click({ force: true }).dblclick({ force: true });
        graphToolTile.getGraphPolygon().should('exist');
      });
      it('will add angle to a table point', function () {
        tableToolTile.getTableIndexColumnCell().contains('3').click({ force: true });
        graphToolTile.getGraphPoint().first().click({ force: true }).dblclick({ force: true });
        graphToolTile.showAngle();
        graphToolTile.getAngleAdornment().should('exist');

      });
      it('will move a point by changing coordinates on the table', function () {
        let new_y = '8';
        tableToolTile.getTableTile().click();
        cy.get(".primary-workspace").within((workspace) => {
          tableToolTile.getTableCell().eq(10).click();
          tableToolTile.getTableCell().eq(10).type(new_y + '{enter}');
        });
        graphToolTile.getGraphPointCoordinates(2).should('contain', '(6, ' + new_y + ')');
      });
      it('will delete a point in the table', function () {
        let point = 0; //the 4th point in the graph
        tableToolTile.getTableTile().click();
        tableToolTile.removeRow(point);

        //verifies p1 no longer exist in table and graph
        tableToolTile.getTableRow().should('have.length', 4);
        tableToolTile.getTableIndexColumnCell().eq(2).should('contain', '3');
        tableToolTile.getTableIndexColumnCell().eq(3).should('not.contain', 'p4');
        graphToolTile.getGraphPointLabel().contains('p4').should('not.exist');
        graphToolTile.getGraphPointID(point)
          .then((id) => {
            id = '#'.concat(id);
            cy.get(id).then(($el) => {
              expect($el).to.not.be.visible;
            });
          });
        //verifies angle adornment no longer exists
        // graphToolTile.getAngleAdornment().should('not.exist'); TODO
      });
    });
    describe.skip('text axes changes', function () {
      it('will change the name of the x-axis in the table', function () {
        tableToolTile.getTableTile().click();
        cy.get(".primary-workspace").within((workspace) => {
          tableToolTile.renameColumn('x', 'mars');
        });
        graphToolTile.getGraphAxisLabelId('x')
          .then((id) => {
            id = '#'.concat(id);
            cy.get(id).then(($el) => {
              expect($el.text()).to.contain('mars');
            });
          });
      });
      it('will change the name of the y-axis in the table', function () {
        tableToolTile.getTableTile().click();
        cy.get(".primary-workspace").within((workspace) => {
          tableToolTile.renameColumn('y', 'venus');
        });
        graphToolTile.getGraphAxisLabelId('y')
          .then((id) => {
            id = '#'.concat(id);
            cy.get(id).then(($el) => {
              expect($el.text()).to.contain('venus');
            });
          });
      });
    });
    describe.skip('normal graph interactions', function () {
      it('will add a polygon directly onto the graph', function () {
        graphToolTile.getGraphTile().click();
        graphToolTile.addPointToGraph(10, 10); //not sure why this isn't appearing
        graphToolTile.addPointToGraph(10, 10);
        graphToolTile.addPointToGraph(15, 10);
        graphToolTile.addPointToGraph(10, 5);
        graphToolTile.getGraphPoint().last().click({ force: true }).click({ force: true });
      });
      it('will add an angle to a point created from a table', function () {
        graphToolTile.getGraphPolygon().last().click({ force: true });
        graphToolTile.showAngle();
        graphToolTile.getAngleAdornment().should('exist');
      });
    });
    describe.skip('test non-numeric entries in table', function () {
      it('will enter non-numeric number in the table', function () {
        tableToolTile.getTableCellWithColIndex(2, 6).scrollIntoView();
        tableToolTile.getTableCellWithColIndex(2, 6).click({ force: true }).type(9);
        tableToolTile.getTableCell().eq(3).should('contain', x[1]);
      });
    });

  });
  context('Save and restore keeps the connection between table and graph', function () {
    before(function () {
      let title = '2.3 Mouthing Off and Nosing Around';
      canvas.createNewExtraDocumentFromFileMenu("empty", 'my-work');
      cy.wait(2000);
      cy.openResourceTabs();
      cy.openTopTab('my-work');
      cy.openDocumentWithTitle('my-work', 'workspaces', title);
      cy.collapseResourceTabs();
    });
    it('verify connection of table and graph on restored canvas', function () {
      graphToolTile.getGraphPointLabel().contains('A').should('exist');
    });
  });
  context.skip('Delete connected table', function () {
    it('will delete connected table', function () {
      clueCanvas.deleteTile('table');
      graphToolTile.getGraphPointLabel().contains('p1').should('not.exist');
    });
    it('will verify graph is still functional after connected table is deleted', function () {
      graphToolTile.getGraphTile().click();
      graphToolTile.addPointToGraph(2, 6);
      graphToolTile.getGraphPoint().should('exist').and('have.length', 3);
    });
  });
});

context("Dragging to copy linked tiles", () => {
  before(function () {
    const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&problem=2.3&qaGroup=5"; //using different problem bec. 2.1 disables graph table integration
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    // cy.collapseResourceTabs();

    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
  });

  describe("Can drag to copy linked tiles from the left panel", () => {
    const dataTransfer = new DataTransfer;
    it("drag a linked table and geometry tile", () => {
      // Set up and link table and geometry tile
      clueCanvas.addTile('table');
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getTableCell().eq(1).click().type(x[0] +'{enter}');
        tableToolTile.getTableCell().eq(2).click();
        tableToolTile.getTableCell().eq(2).type(y[0] +'{enter}');
        tableToolTile.getTableCell().eq(5).click();
        tableToolTile.getTableCell().eq(5).type(x[1] + '{enter}');
        tableToolTile.getTableCell().eq(6).click();
        cy.wait(500);
        tableToolTile.getTableCell().eq(6).type(y[1] + '{enter}');
        tableToolTile.getTableCell().eq(9).click();
      });
      clueCanvas.addTile('geometry');
      textToolTile.deleteTextTile();
      cy.linkTableToGraph('Table 1', "Graph 1");

      // Open the document on the left, then create a new document on the right
      resourcesPanel.openPrimaryWorkspaceTab("my-work");
      cy.get(".tab-panel-documents-section .list-item").first().click();
      canvas.createNewExtraDocumentFromFileMenuWithoutTabs("Test Document", "my-work");
      cy.wait(100);

      // Select the table and geometry tiles on the left
      const leftTile = type => cy.get(`.nav-tab-panel .documents-panel .${type}-tool-tile`);
      leftTile('table').first().click();
      leftTile('geometry').first().click({ shiftKey: true });

      // Drag the selected tiles to the workspace on the right
      leftTile('geometry').first().trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
        .trigger('drop', { force: true, dataTransfer });

      // The copied geometry tile should have two points from its linked shared dataset
      graphToolTile.getGraphPoint().should("exist").and("have.length", 2);

      // Drag just the geometry tile from the left to the right
      leftTile('table').first().click({ shiftKey: true });
      leftTile('geometry').first().trigger('dragstart', { dataTransfer });
      cy.get('.single-workspace .canvas .document-content').first()
        .trigger('drop', { force: true, dataTransfer });

      // We should now have a total of four points, two in each table
      graphToolTile.getGraphPoint().should("exist").and("have.length", 4);

      // Add a new point to the table
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getTableCell().eq(9).click();
        tableToolTile.getTableCell().eq(9).type(x[2] + '{enter}');
        tableToolTile.getTableCell().eq(10).click();
        tableToolTile.getTableCell().eq(10).type(y[2] + '{enter}');
        tableToolTile.getTableCell().eq(13).click();
      });

      // The new point should only appear in the first copied geometry tile, so we now have a total of five
      graphToolTile.getGraphPoint().should("exist").and("have.length", 5);
    });
  });

});
