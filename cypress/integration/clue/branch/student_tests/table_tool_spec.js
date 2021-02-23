import Canvas from '../../../../support/elements/common/Canvas';
import TableToolTile from '../../../../support/elements/clue/TableToolTile';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';

let canvas = new Canvas,
  clueCanvas = new ClueCanvas,
  tableToolTile = new TableToolTile;

let headerX = 'pluto';
let headerY = 'mars';

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
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.renameColumn('x', headerX);
        tableToolTile.getColumnHeaderText().then((text) => {
          expect(text[0]).to.be.eq(headerX);
        });
      });
    });
    it('will change column y name', function () {
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.renameColumn('y', headerY);
        tableToolTile.getColumnHeaderText().then((text) => {
          expect(text[1]).to.be.eq(headerY);
        });
      });
    });
    it('will add a column', function () {
      tableToolTile.getAddColumnButton().click();
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().should('have.length', 3);
      });
    });
    it('verify first column cannot be deleted', function () {
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().eq(0).click();
        tableToolTile.getRemoveColumnButton().should('not.be.visible');
      });
    });
    it('will remove a column', function () {
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().contains(headerY).click();
        tableToolTile.getRemoveColumnButton().eq(0).should('be.visible').click();
      });
      cy.get('.modal-title').should('be.visible').and('contain', 'Remove Column');
      cy.get('.modal-content').should('contain', 'Remove column').and('contain', headerY);
      cy.get('.modal-button').contains('Remove Column').click();
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().should('have.length', 2);
        tableToolTile.getColumnHeaderText().then((text) => {
          expect(text[0]).to.be.eq('pluto');
          expect(text[1]).to.be.eq('y2');
        });
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
    tableToolTile.getTableCell().eq(2).type('2.5{enter}');
    tableToolTile.getTableCell().eq(5).click();
    // cy.wait(100);
    tableToolTile.getTableCell().eq(2).should('contain', '2.5');
    tableToolTile.getTableCell().eq(1).click().type('5{enter}');
    tableToolTile.getTableCell().eq(5).click();
    // cy.wait(100);
    tableToolTile.getTableCell().eq(1).should('contain', '5');
    tableToolTile.getTableRow().should('have.length', 2);
  });
  it('will toggle index numbers', function () {
    cy.get(".primary-workspace").within(() => {
      tableToolTile.getIndexNumberToggle().click();
      cy.get(".index-cell-contents").eq(0).should('contain', 1);
      cy.get(".index-cell-contents").eq(1).should('contain', "");
    });
  });
  it('will remove a row', function () {
    tableToolTile.removeRow("0");
    tableToolTile.getTableRow().should('have.length', 1);
    cy.get(".index-cell-contents").eq(0).should('contain', "");
  });
});
describe("formulas", function () {
  let formula = "3*pluto+2";
  it('will verify formula modal', function () {
    tableToolTile.getTableToolbarButton('set-expression').click();
    cy.get('.modal-title').should('contain', "Set Expression");
    cy.get('.modal-content .prompt select').should('not.exist');
    cy.get('.modal-content .prompt').should('contain', "y2");
  });
  it('will enter a formula', function () {
    cy.get('#expression-input').click().type(formula + '{enter}');
    cy.get('.ReactModalPortal').should('not.exist');
  });
  it('verify formula appears under correct column header', function () {
    cy.get('.editable-header-cell')
      .contains('y2')
      .first()
      .siblings('.expression-cell.has-expression')
      .should('contain', formula);
  });
  it('verify selection of y axis when there is more than one',function(){
    tableToolTile.getAddColumnButton().click();
    tableToolTile.renameColumn('y', headerY); //makes it easier to find the correct column header
    tableToolTile.getTableToolbarButton('set-expression').click();
    cy.get('.modal-title').should('contain', "Set Expression");
    cy.get('.modal-content .prompt select').should('exist');
    cy.get('.modal-content .prompt select').select(headerY);
    cy.get('.expression label').should('contain', headerY);
  });
  it('verify cancel does not enter in a formula', function(){
    cy.get('#expression-input').click().type(formula );
    cy.get('.modal-button').contains('Cancel').click();
    cy.get('.editable-header-cell')
      .contains('y')
      .first()
      .siblings('.expression-cell.has-expression')
      .should('not.exist');
    });
});
describe('delete table', function () {
  it('verify delete table', function () {
    tableToolTile.getTableTile().click();
    clueCanvas.deleteTile('table');
  });
});

after(function () {
  cy.clearQAData('all');
});
