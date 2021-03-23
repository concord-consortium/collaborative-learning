import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import GraphToolTile from '../../../../support/elements/clue/GraphToolTile';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';

const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const graphToolTile = new GraphToolTile;
const tableToolTile = new TableToolTile;

before(function () {
  const baseUrl = `${Cypress.config("baseUrl")}`;
  const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&problem=2.3&qaGroup=5"; //using different problem bec. 2.1 disables graph table integration
  cy.clearQAData('all');

  cy.visit(baseUrl + queryParams);
  cy.waitForSpinner();
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
});

context('Tests for graph and table integration', function () {
  const x = ['3', '7', '6', '0'];
  const y = ['2.5', '5', '1', '0'];
  before(function () {
    clueCanvas.addTile('table');
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

    clueCanvas.addTile('geometry');
    clueCanvas.deleteTile('text');
    clueCanvas.addTile('geometry');
    clueCanvas.deleteTile('text');
    graphToolTile.getGraphTitle().last().type('Second One{enter}');

  });
  describe('Link graph dialog', () => {
    it('verify correct graph names appear in selection list', function () {
      tableToolTile.getTableTile().click();
      cy.get('.primary-workspace .link-geometry-button').click();
      cy.wait(2000);
      cy.get('[data-test=link-graph-select]').select('Second One');
      cy.get('[data-test=link-graph-select]').select('Graph 1');
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
    it('verify points added has p1 label in table and graph', function () {
      tableToolTile.getIndexNumberToggle().click();
      tableToolTile.getTableIndexColumnCell().first().should('contain', '1');
      graphToolTile.getGraphPointLabel().contains('p1').should('exist');
    });
    it('verify table can be linked to two graphs', function () {
      cy.linkTableToGraph('Table 1', "Second One");
      graphToolTile.getGraphTile().siblings(clueCanvas.linkIconEl()).should('have.length', 2);
      // graphToolTile.getGraphPointLabel().contains('p1').should('have.length', 2);
    });
    it('verify unlink of graph and table', function () {
      cy.unlinkTableToGraph('Table 1', "Second One");
      graphToolTile.getGraphTile().siblings(clueCanvas.linkIconEl()).should('have.length', 1);
      graphToolTile.getGraph().last().should('not.have.class', 'is-linked');
    });
    it('verify point no longer has p1 in table and graph', function () {
      graphToolTile.getGraphPointLabel().contains('p1').should('have.length', 1);
    });
    after(function () {
      clueCanvas.deleteTile('graph');
    });
  });
  describe('test creating a polygon', function () {
    it('will create a polygon', function () {
      graphToolTile.getGraphPoint().last().click({ force: true }).dblclick({ force: true });
      graphToolTile.getGraphPolygon().should('exist');
    });
    it.skip('will add angle to a table point', function () {
      tableToolTile.getTableIndexColumnCell().contains('3').click({ force: true });
      graphToolTile.getGraphTile().click();
      graphToolTile.showAngle();
      graphToolTile.getAngleAdornment().should('exist');
    });
    it('will move a point by changing coordinates on the table', function () {
      let new_y = '8';
      tableToolTile.getTableTile().click();
      tableToolTile.getTableCell().eq(10).click();
      tableToolTile.getTableCell().eq(10).type(new_y + '{enter}');
      graphToolTile.getGraphPointCoordinates(2).should('contain', '(6, ' + new_y + ')');
    });
    it.skip('will delete a point in the table', function () {
      let point = 0; //the 4th point in the graph
      tableToolTile.getTableTile().click();
      tableToolTile.removeRow(point);
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
  describe('text axes changes', function () {
    it('will change the name of the x-axis in the table', function () {
      tableToolTile.getTableTile().click();
      tableToolTile.renameColumn('x', 'mars');
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
      tableToolTile.renameColumn('y', 'venus');
      graphToolTile.getGraphAxisLabelId('y')
        .then((id) => {
          id = '#'.concat(id);
          cy.get(id).then(($el) => {
            expect($el.text()).to.contain('venus');
          });
        });
    });
  });
  describe('normal graph interactions', function () {
    it('will add a polygon directly onto the graph', function () {
      graphToolTile.getGraphTile().click();
      graphToolTile.addPointToGraph(5, 5); //not sure why this isn't appearing
      graphToolTile.addPointToGraph(10, 15);
      graphToolTile.addPointToGraph(13, 10);
      graphToolTile.addPointToGraph(5, 10);
      graphToolTile.getGraphPoint().last().click({ force: true }).click({ force: true });
    });
    it.skip('will add and angle to a point created from a table', function () {
      graphToolTile.showAngle();
      graphToolTile.getAngleAdornment().should('exist');
    });
  });
  describe.skip('test non-numeric entries in table', function () {
    it('will enter non-numeric number in the table', function () {
      tableToolTile.getTableCell().eq(5).type('g{enter}');
      tableToolTile.getTableCell().eq(5).should('contain', x[1]);
    });
  });

});
context('Save and restore keeps the connection between table and graph', function () {
  before(function () {
    let title = '2.3 Mouthing Off and Nosing Around';
    canvas.createNewExtraDocumentFromFileMenu("empty",'my-work');
    cy.wait(2000);
    cy.openTab('my-work');
    cy.openDocumentWithTitle('my-work', 'workspaces', title);
    cy.closeTabs();
  });
  it('verify connection of table and graph on restored canvas', function () {
    graphToolTile.getGraphPointLabel().contains('p1').should('exist');
  });
});
context('Delete connected table', function () {
  it('will delete connected table', function () {
    clueCanvas.deleteTile('table');
    graphToolTile.getGraphPointLabel().contains('p1').should('not.exist');
  });
  it.skip('will verify graph is still functional after connected table is deleted', function () {
    graphToolTile.getGraphTile().click();
    graphToolTile.addPointToGraph(2, 6);
    graphToolTile.getGraphPoint().should('exist').and('have.length', 2);
  });
});
