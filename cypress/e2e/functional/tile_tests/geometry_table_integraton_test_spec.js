import ResourcesPanel from '../../../support/elements/common/ResourcesPanel';
import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import TextToolTile from '../../../support/elements/tile/TextToolTile';

let resourcesPanel = new ResourcesPanel;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const geometryToolTile = new GeometryToolTile;
const tableToolTile = new TableToolTile;
const textToolTile = new TextToolTile;

const x = ['3', '7', '6', '0'];
const y = ['2.5', '5', '1', '0'];

function beforeTest() {
  const queryParams = "?appMode=qa&fakeClass=5&fakeUser=student:5&problem=2.3&qaGroup=5"; //using different problem bec. 2.1 disables graph table integration
  cy.clearQAData('all');

  cy.visit(queryParams);
  cy.waitForLoad();
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
}

context('Geometry Table Integration', function () {
  it('Tests for geometry and table integration', function () {
    beforeTest();
    clueCanvas.addTile('table');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getTableCell().eq(1).click();
      tableToolTile.getTableCell().eq(1).click();
      tableToolTile.getTableCell().eq(1).type(x[0] + '{enter}');
      tableToolTile.getTableCell().eq(2).click();
      tableToolTile.getTableCell().eq(2).type(y[0] + '{enter}');
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

    cy.log('verify correct geometry tile names appear in selection list');
    tableToolTile.getTableTile().click();
    clueCanvas.clickToolbarButton('table', 'link-tile');
    cy.wait(2000);
    // cy.get('[data-test=link-tile-select]').select('Second One');
    cy.get('[data-test=link-tile-select]').select('Shapes Graph 1');

    cy.get('.ReactModalPortal button').contains('Cancel').click();

    cy.log("connect and disconnect table and geometry after coordinates have been added");
    cy.log('verify link icon appears when table and geometry are connected');
    cy.get(clueCanvas.linkIconEl()).should('not.exist');
    cy.linkTableToTile('Table 1', "Shapes Graph 1");
    tableToolTile.getTableTile().scrollIntoView();
    geometryToolTile.getGeometryTile().siblings(clueCanvas.linkIconEl()).should('exist');
    // verifies that values exported from .scss file were successfully imported
    geometryToolTile.getGeometryTile().siblings(clueCanvas.linkIconEl()).children('svg').attribute('data-indicator-width').should('exist');
    geometryToolTile.getGraph().should('have.class', 'is-linked');

    cy.log('verify points added has label in table and geometry');
    tableToolTile.getIndexNumberToggle().should('exist').click({ force: true });
    tableToolTile.getTableIndexColumnCell().first().should('contain', '1');
    geometryToolTile.getGraphPointLabel().contains('A').should('exist');
    geometryToolTile.getGraphPointLabel().contains('B').should('exist');
    geometryToolTile.getGraphPointLabel().contains('C').should('exist');
    geometryToolTile.getGraphPointLabel().contains('D').should('exist');

    cy.log('verify table can be linked to two geometry tiles');
    clueCanvas.addTile('geometry');
    cy.linkTableToTile('Table 1', "Shapes Graph 2");
    geometryToolTile.getGeometryTile().siblings(clueCanvas.linkIconEl()).should('have.length', 2);

    cy.log('verify unlink of geometry and table');
    cy.unlinkTableToTile('Table 1', "Shapes Graph 2");
    geometryToolTile.getGeometryTile().siblings(clueCanvas.linkIconEl()).should('have.length', 1);
    geometryToolTile.getGraph().last().should('not.have.class', 'is-linked');

    cy.log('verify point no longer has p1 in table and geometry');
    geometryToolTile.getGraphPointLabel().contains('A').should('have.length', 1);

    clueCanvas.deleteTile('geometry');
  });

  it.skip('test creating a polygon', function () {
    beforeTest();
    clueCanvas.addTile('table');
    clueCanvas.addTile('geometry');
    cy.log('will create a polygon');
    geometryToolTile.getGraphPoint().last().click({ force: true }).dblclick({ force: true });
    geometryToolTile.getGraphPolygon().should('exist');

    cy.log('will add angle to a table point');
    tableToolTile.getTableIndexColumnCell().contains('3').click({ force: true });
    geometryToolTile.getGraphPoint().first().click({ force: true }).dblclick({ force: true });
    geometryToolTile.showAngle();
    geometryToolTile.getAngleAdornment().should('exist');

    cy.log('will move a point by changing coordinates on the table');
    let new_y = '8';
    tableToolTile.getTableTile().click();
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getTableCell().eq(10).click();
      tableToolTile.getTableCell().eq(10).type(new_y + '{enter}');
    });
    geometryToolTile.getGraphPointCoordinates(2).should('contain', '(6, ' + new_y + ')');

    cy.log('will delete a point in the table');
    let point = 0; //the 4th point in the graph
    tableToolTile.getTableTile().click();
    tableToolTile.removeRow(point);

    //verifies p1 no longer exist in table and geometry
    tableToolTile.getTableRow().should('have.length', 4);
    tableToolTile.getTableIndexColumnCell().eq(2).should('contain', '3');
    tableToolTile.getTableIndexColumnCell().eq(3).should('not.contain', 'p4');
    geometryToolTile.getGraphPointLabel().contains('p4').should('not.exist');
    geometryToolTile.getGraphPointID(point).then((id) => {
      id = '#'.concat(id);
      cy.get(id).then(($el) => {
        expect($el).to.not.be.visible;
      });
    });

    cy.log('will change the name of the x-axis in the table');
    tableToolTile.getTableTile().click();
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.renameColumn('x', 'mars');
    });
    geometryToolTile.getGraphAxisLabelId('x').then((id) => {
      id = '#'.concat(id);
      cy.get(id).then(($el) => {
        expect($el.text()).to.contain('mars');
      });
    });

    cy.log('will change the name of the y-axis in the table');
    tableToolTile.getTableTile().click();
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.renameColumn('y', 'venus');
    });
    geometryToolTile.getGraphAxisLabelId('y').then((id) => {
      id = '#'.concat(id);
      cy.get(id).then(($el) => {
        expect($el.text()).to.contain('venus');
      });
    });

    cy.log('normal geometry interactions');
    cy.log('will add a polygon directly onto the geometry');
    geometryToolTile.getGeometryTile().click();
    geometryToolTile.addPointToGraph(10, 10); //not sure why this isn't appearing
    geometryToolTile.addPointToGraph(10, 10);
    geometryToolTile.addPointToGraph(15, 10);
    geometryToolTile.addPointToGraph(10, 5);
    geometryToolTile.getGraphPoint().last().click({ force: true }).click({ force: true });

    cy.log('will add an angle to a point created from a table');
    geometryToolTile.getGraphPolygon().last().click({ force: true });
    geometryToolTile.showAngle();
    geometryToolTile.getAngleAdornment().should('exist');


    cy.log('test non-numeric entries in table');
    cy.log('will enter non-numeric number in the table');
    tableToolTile.getTableCellWithColIndex(2, 6).scrollIntoView();
    tableToolTile.getTableCellWithColIndex(2, 6).click({ force: true }).type(9);
    tableToolTile.getTableCell().eq(3).should('contain', x[1]);
  });

  it("Dragging to copy linked tiles", () => {
    beforeTest();

    const dataTransfer = new DataTransfer;
    cy.log("drag a linked table and geometry tile");
    // Set up and link table and geometry tile
    clueCanvas.addTile('table');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getTableCell().eq(1).click();
      tableToolTile.getTableCell().eq(1).click();
      tableToolTile.getTableCell().eq(1).type(x[0] + '{enter}');
      tableToolTile.getTableCell().eq(2).click();
      tableToolTile.getTableCell().eq(2).type(y[0] + '{enter}');
      tableToolTile.getTableCell().eq(5).click();
      tableToolTile.getTableCell().eq(5).type(x[1] + '{enter}');
      tableToolTile.getTableCell().eq(6).click();
      cy.wait(500);
      tableToolTile.getTableCell().eq(6).type(y[1] + '{enter}');
      tableToolTile.getTableCell().eq(9).click();
    });
    clueCanvas.addTile('geometry');
    textToolTile.deleteTextTile();
    cy.linkTableToTile('Table 1', "Shapes Graph 1");

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
    geometryToolTile.getGraphPoint().should("exist").and("have.length", 2);

    // Drag just the geometry tile from the left to the right
    leftTile('table').first().click({ shiftKey: true });
    leftTile('geometry').first().trigger('dragstart', { dataTransfer });
    cy.get('.single-workspace .canvas .document-content').first()
      .trigger('drop', { force: true, dataTransfer });

    // We should now have a total of four points, two in each table
    geometryToolTile.getGraphPoint().should("exist").and("have.length", 4);

    // Add a new point to the table
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getTableCell().eq(9).click();
      cy.wait(500);
      tableToolTile.getTableCell().eq(9).click().type(x[2] + '{enter}');
      tableToolTile.getTableCell().eq(10).click();
      tableToolTile.getTableCell().eq(10).type(y[2] + '{enter}');
      // The first .type here stopped working, so we have to do it twice.
      tableToolTile.getTableCell().eq(9).click();
      tableToolTile.getTableCell().eq(9).type(x[2] + '{enter}');
      tableToolTile.getTableCell().eq(13).click();
    });

    // The new point should only appear in the first copied geometry tile, so we now have a total of five
    geometryToolTile.getGraphPoint().should("exist").and("have.length", 5);
  });
});