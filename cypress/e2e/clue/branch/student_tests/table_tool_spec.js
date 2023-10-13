import TableToolTile from '../../../../support/elements/clue/TableToolTile';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import Canvas from '../../../../support/elements/common/Canvas';

let clueCanvas = new ClueCanvas,
  tableToolTile = new TableToolTile;
const canvas = new Canvas;

let headerX = 'pluto';
let headerY = 'mars';
// let headerX = 'x';
// let headerY = 'y';
let headerY2 = 'y';

let copyTitle = 'Table Tile Workspace Copy';

context('Table Tool Tile', function () {
  before(function () {
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.showOnlyDocumentWorkspace();
  });

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
          expect(text[0]).to.be.eq(headerX);
          expect(text[1]).to.be.eq(headerY2);
        });
      });
    });
  });

  describe('edit table entries', function () {
    // TODO: Found 1, expected 3
    it('will add content to table', function () {
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(1, '3');
        tableToolTile.getTableCell().eq(1).should('contain', '3');
        tableToolTile.typeInTableCell(2, '2.5');
        tableToolTile.getTableCell().eq(2).should('contain', '2.5');
        tableToolTile.typeInTableCell(1, '5');
        tableToolTile.getTableCell().eq(1).should('contain', '5');
        tableToolTile.getTableRow().should('have.length', 2);
      });
    });
    it('delete button works', function () {
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getTableCell().eq(1).should('contain', '5');
        tableToolTile.getTableToolbarButton('delete').click();
        tableToolTile.getTableCell().eq(1).should('contain', '');
      });
    });
    it('will toggle index numbers', function () {
      tableToolTile.getIndexNumberToggle().click();
      cy.get(".primary-workspace").within(() => {
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
    let formula = `3*${headerX}+2`;
    it('will verify formula modal', function () {
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getTableToolbarButton('set-expression').click();
      });
      cy.get('.modal-title').should('contain', "Set Expression");
      cy.get('.modal-content .prompt select').should('not.exist');
      cy.get('.modal-content .prompt').should('contain', "y");
    });
    it('will enter a formula', function () {
      cy.get('#expression-input').click().type(formula + '{enter}');
      cy.get('.ReactModalPortal').should('not.exist');
    });
    it('verify formula appears under correct column header', function () {
      cy.get('.editable-header-cell')
        .contains('.header-name', 'y')
        .parent()
        .siblings('.expression-cell.has-expression')
        .should('contain', formula);
    });
    it('verify selection of y axis when there is more than one',function(){
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getAddColumnButton().click();
        tableToolTile.renameColumn('y', headerY); //makes it easier to find the correct column header
        tableToolTile.getTableToolbarButton('set-expression').click();
      });
      cy.get('.modal-title').should('contain', "Set Expression");
      cy.get('.modal-content .prompt select').should('exist');
      cy.get('.modal-content .prompt select').select(headerY);
      cy.get('.expression label').should('contain', headerY);
    });
    it('verify clear button functionality', function(){
      cy.get('.modal-button').contains('Clear').click();
      cy.get('#expression-input').should('not.contain', formula);
    });
    it('verify cancel does not enter in a formula', function(){
      cy.get('#expression-input').click().type(formula );
      cy.get('.modal-button').contains('Cancel').click();
      cy.get('.editable-header-cell')
        .contains(headerY) // y2 also contains "y" so this no longer works
        .first()
        .siblings('.expression-cell.has-expression')
        .should('not.exist');
    });
    it('verify selection of y2 axis and will enter a formula',function(){
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.getTableToolbarButton('set-expression').click();
      });
      cy.get('.modal-title').should('contain', "Set Expression");
      cy.get('.modal-content .prompt select').should('exist');
      cy.get('.modal-content .prompt select').select('y2');
      cy.get('.modal-content .prompt').should('contain', 'y2');
      cy.get('#expression-input').click().type(`${headerX}+2{enter}`);
    });
    it('verify value calculated based on formula correctly', function () {
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(1, '3');
        tableToolTile.getTableCell().eq(1).should('contain', '3');
        tableToolTile.getTableCell().eq(2).should('contain', '11');
        tableToolTile.getTableCell().eq(3).should('contain', '5');
        tableToolTile.typeInTableCell(1, '5');
        tableToolTile.getTableCell().eq(2).should('contain', '17');
        tableToolTile.getTableCell().eq(3).should('contain', '7');
        tableToolTile.typeInTableCell(6, 'a');
        tableToolTile.getTableCell().eq(7).should('contain', 'NaN');
        tableToolTile.getTableCell().eq(8).should('contain', 'NaN');
        });
    });
    it('verifies restore of table field content in copy document',()=>{
        const title = "table test";
        //copy investigation
        canvas.copyDocument(copyTitle);
        cy.wait(1000);
        canvas.getPersonalDocTitle().should('contain', copyTitle);
        tableToolTile.getTableTitle().should('contain', title);
        tableToolTile.getTableCell().eq(1).should('contain', '5');
        tableToolTile.getTableCell().eq(2).should('contain', '17');
        tableToolTile.getTableCell().eq(3).should('contain', '7');

        cy.get(".primary-workspace").within((workspace) => {
          cy.get('.editable-header-cell')
          .contains('.header-name', 'mars')
          .parent()
          .siblings('.expression-cell.has-expression')
          .should('contain', formula);
        });

        canvas.deleteDocument();
    });
  });
  describe('delete table', function () {
    it('verify delete table', function () {
      tableToolTile.getTableTile().click();
      clueCanvas.deleteTile('table');
    });
  });
});

context('Table Tool Tile Undo Redo', function () {
  before(function () {
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.showOnlyDocumentWorkspace();
  });

  describe('Test undo redo actions', function () {
    it('will undo redo table tile creation/deletion', function () {
      // Creation - Undo/Redo
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
      clueCanvas.getUndoTool().should("not.have.class", "disabled");
      clueCanvas.getRedoTool().should("have.class", "disabled");
      clueCanvas.getUndoTool().click();
      tableToolTile.getTableTile().should("not.exist");
      clueCanvas.getUndoTool().should("have.class", "disabled");
      clueCanvas.getRedoTool().should("not.have.class", "disabled");
      clueCanvas.getRedoTool().click();
      tableToolTile.getTableTile().should("exist");
      clueCanvas.getUndoTool().should("not.have.class", "disabled");
      clueCanvas.getRedoTool().should("have.class", "disabled");

      // Deletion - Undo/Redo
      clueCanvas.deleteTile('table');
      tableToolTile.getTableTile().should('not.exist');
      clueCanvas.getUndoTool().click();
      tableToolTile.getTableTile().should("exist");
      clueCanvas.getRedoTool().click();
      tableToolTile.getTableTile().should('not.exist');
    });
    it('will undo redo table field content', function () {
      clueCanvas.addTile('table');
      tableToolTile.getAddColumnButton().click();
      tableToolTile.getAddColumnButton().click();
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().should('have.length', 4);
      });
      clueCanvas.getUndoTool().click().click();
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().should('have.length', 2);
      });
      clueCanvas.getRedoTool().click();
      cy.get('.primary-workspace').within(function () {
        tableToolTile.getColumnHeader().should('have.length', 3);
      });
    });
  });
});


//-------Add New Tests-------------------------
//TODO: Since this file uses url params: http://localhost:8080/?appMode=qa&fakeClass=5&fakeUser=student:5&demoOffering=5&problem=2.1&qaGroup=5
//which defaults to unit: SAS. I noticed there actually is no element on the toolbar for the XY Plot.

context('Table Tile View Graph As Data Button', function() {
  before(function () {
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    cy.showOnlyDocumentWorkspace();
  });

  describe('Test View Graph as Data Button', function() {
    it('will link to an XY Plot using the "View Data as Graph" button', function () {
      clueCanvas.addTile('table');
      cy.get(".primary-workspace").within((workspace) => {
        tableToolTile.typeInTableCell(1, '5');
        tableToolTile.typeInTableCell(2, '2.5');
        tableToolTile.typeInTableCell(5, '5');
        tableToolTile.typeInTableCell(6, '7');
        tableToolTile.getViewDataButton().click();
        cy.pause();
        tableToolTile.getLinkGraphModalCreateNewButton().click();
      });
    });
  });
});

