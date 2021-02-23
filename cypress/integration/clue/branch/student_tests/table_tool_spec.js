import Canvas from '../../../../support/elements/common/Canvas';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';

let canvas = new Canvas,
  clueCanvas = new ClueCanvas,
  tableToolTile = new TableToolTile;

before(function () {
  const baseUrl = `${Cypress.config("baseUrl")}`;
  const queryParams = `${Cypress.config("queryParams")}`;
  cy.clearQAData('all');

  cy.visit(baseUrl + queryParams);
  cy.waitForSpinner();
});

context('Table Tool Tile', function () {
  describe('Test table functions', function () {
    it('will add a table to canvas', function () {
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
    });
    it('verify table title can be edited', function () {
      const title = "table test";
      tableToolTile.getTableTitle().click().type(title + '{enter}');
      tableToolTile.getTableTitle().should('contain', title);
    });
    it('will verify there are only two columns x & y', function () {
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getColumnHeaderText().then(($headers) => {
          expect(($headers.length)).to.be.eq(2);
        });
        tableToolTile.getColumnHeaderText().each((header, index, $header_list) => {
          let headerText = ['x', 'y'];
          cy.wrap(header).should('contain', headerText[index]);
        });
      });

    });
    it('will change column x name', function () {
      let header = 'pluto';
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.renameColumn('x', header);
        tableToolTile.getColumnHeaderText().then((text)=>{
          expect(text[0]).to.be.eq(header);
        });
      });
    });
    it('will change column y name', function () {
      let header = 'mars';
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.renameColumn('y', header);
        tableToolTile.getColumnHeaderText().then((text)=>{
          expect(text[1]).to.be.eq(header);
        });
      });
    });
  });
  describe('edit table entries', function () {
    // TODO: Found 1, expected 3
    it('will add content to table', function () {
      tableToolTile.getTableCell().eq(1).click().type('3{enter}');
      tableToolTile.getTableCell().eq(2).click();
      // cy.wait(100);
      tableToolTile.getTableCell().eq(1).should('contain', '3');
      tableToolTile.getTableCell().eq(2).click().type('2{enter}');
      tableToolTile.getTableCell().eq(5).click();
      // cy.wait(100);
      tableToolTile.getTableCell().eq(2).should('contain', '2');
      tableToolTile.getTableCell().eq(1).click().type('1{enter}');
      tableToolTile.getTableCell().eq(5).click();
      // cy.wait(100);
      tableToolTile.getTableCell().eq(1).should('contain', '1');
      tableToolTile.getTableRow().should('have.length', 2);
    });
    it('will remove a row', function () {
      tableToolTile.removeRow("0");
      tableToolTile.getTableRow().should('have.length', 1);
    });
  });
  describe('delete table', function () {
    it('verify delete table', function () {
      tableToolTile.getTableTile().click();
      clueCanvas.deleteTile('table');
    });
  });
});

after(function () {
  cy.clearQAData('all');
});
