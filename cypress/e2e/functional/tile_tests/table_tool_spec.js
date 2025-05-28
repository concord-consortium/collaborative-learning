import ClueCanvas from '../../../support/elements/common/cCanvas';
import Canvas from '../../../support/elements/common/Canvas';
import TableToolTile from '../../../support/elements/tile/TableToolTile';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';

let clueCanvas = new ClueCanvas,
  tableToolTile = new TableToolTile,
  xyplot = new XYPlotToolTile;

const canvas = new Canvas;

let headerX = 'pluto';
let headerY = 'mars';
// let headerX = 'x';
// let headerY = 'y';
let headerY2 = 'y';

let copyTitle = 'Table Tile Workspace Copy';

function beforeTest() {
  const queryParams = `${Cypress.config("qaNoNavPanelUnitStudent5")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  cy.showOnlyDocumentWorkspace();
}

context('Table Tool Tile', function () {
  it('Test table functions', function () {
    beforeTest();

    cy.log('will add a table to canvas');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('be.visible');

    cy.log('verify table title can be edited');
    const title = "table test";
    tableToolTile.getTableTitle().click().type(title + '{enter}');
    tableToolTile.getTableTitle().should('contain', title);

    cy.log('will verify there are only two columns x & y');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getColumnHeaderText().then(($headers) => {
        expect(($headers.length)).to.be.eq(2);
      });
      tableToolTile.getColumnHeaderText().each((header, index, $header_list) => {
        let headerText = ['x', 'y'];
        cy.wrap(header).should('contain', headerText[index]);
      });
    });

    cy.log('will change column x name');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.renameColumn('x', headerX);
      tableToolTile.getColumnHeaderText().then((text) => {
        expect(text[0]).to.be.eq(headerX);
      });
    });

    cy.log('will change column y name');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.renameColumn('y', headerY);
      tableToolTile.getColumnHeaderText().then((text) => {
        expect(text[1]).to.be.eq(headerY);
      });
    });

    cy.log('will add a column');
    tableToolTile.getAddColumnButton().click();
    cy.get('.primary-workspace').within(function () {
      tableToolTile.getColumnHeader().should('have.length', 3);
    });

    cy.log('verify first column cannot be deleted');
    cy.get('.primary-workspace').within(function () {
      tableToolTile.getColumnHeader().eq(0).click();
      tableToolTile.getRemoveColumnButton().should('not.be.visible');
    });

    cy.log('will remove a column');
    cy.get('.primary-workspace').within(function () {
      tableToolTile.getColumnHeader().contains(headerY).click();
      // Wait for the modal title to appear in the last modal portal
      cy.get('.ReactModalPortal').should('have.length.at.least', 1);
      cy.get('.ReactModalPortal').last().within(() => {
        cy.get('.modal-title').should('be.visible').and('contain', 'Remove Column');
        cy.get('[data-testid=confirm-button]').should('be.visible').click();
      });
      cy.wait(200);
    });
    cy.get('.modal-title').should('be.visible').and('contain', 'Remove Column');
    cy.get('[data-testid=confirm-button]').should('be.visible').click();
    cy.get('.primary-workspace').within(function () {
      tableToolTile.getColumnHeader().should('have.length', 2);
      tableToolTile.getColumnHeaderText().then((text) => {
        expect(text[0]).to.be.eq(headerX);
        expect(text[1]).to.be.eq(headerY2);
      });
    });

    let formula = `3*${headerX}+2`;

    cy.log('will add content to table');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.typeInTableCell(1, '3');
      tableToolTile.getTableCell().eq(1).should('contain', '3');
      tableToolTile.typeInTableCell(2, '2.5');
      tableToolTile.getTableCell().eq(2).should('contain', '2.5');
      tableToolTile.typeInTableCell(1, '5');
      tableToolTile.getTableCell().eq(1).should('contain', '5');
      tableToolTile.getTableRow().should('have.length', 2);
    });

    cy.log('can edit and save changes or edit and cancel changes');
    // confirm with enter key
    tableToolTile.typeInTableCell(1, 'first value', true);
    tableToolTile.getTableCell().eq(1).should('contain', 'first value');
    // confirm with tab key
    tableToolTile.typeInTableCell(1, "second value", false);
    tableToolTile.getTableCellEdit().trigger('keydown', { keyCode: 9 }); // tab
    tableToolTile.getTableCell().eq(1).should('contain', 'second value');
    // confirm by clicking outside of the editor
    tableToolTile.typeInTableCell(1, 'third value', false);
    tableToolTile.getTableCell().eq(2).click();
    tableToolTile.getTableCell().eq(1).should('contain', 'third value');
    // abandon edit with esc key
    tableToolTile.typeInTableCell(1, 'abandon this edit{esc}', false);
    tableToolTile.getTableCell().eq(1).should('contain', 'third value');
    tableToolTile.getTableCell().eq(1).should('not.contain', 'abandon this edit');

    cy.log('can press enter key for edit mode without adding newline or otherwise altering text');
    tableToolTile.typeInTableCell(1, '333');
    tableToolTile.getTableCell().eq(1).should('contain', '333');
    // press enter key to put cell in edit mode
    tableToolTile.getTableCell().eq(1).trigger('keydown', { keyCode: 13 }); // enter
    tableToolTile.getTableCellEdit().should('exist').then($el => {
      const textarea = $el[0];
      const isSelected = textarea.selectionStart === 0 &&
                         textarea.selectionEnd === textarea.value.length;
      expect(isSelected).to.be.true;
      expect(textarea.value).to.equal('333');
    });
    tableToolTile.getTableCellEdit().trigger('keydown', { keyCode: 13 }); // enter
    tableToolTile.getTableCell().eq(1).should('contain', '333');

    cy.log('can press tab key to navigate between cells');
    tableToolTile.getTableCell().eq(1).trigger('keydown', { keyCode: 9 }); // tab
    tableToolTile.getTableCell().eq(2).should('have.attr', 'aria-selected', 'true');
    tableToolTile.getTableCell().eq(1).should('not.have.attr', 'aria-selected', 'true');
    tableToolTile.getTableCell().eq(2).trigger('keydown', { keyCode: 9, shiftKey: true }); // shift+tab
    tableToolTile.getTableCell().eq(1).should('have.attr', 'aria-selected', 'true');
    tableToolTile.getTableCell().eq(2).should('not.have.attr', 'aria-selected', 'true');

    // reset to previous value
    tableToolTile.typeInTableCell(1, '5');

    // Table tile restore upon page reload
    cy.wait(2000);
    cy.reload();
    cy.waitForLoad();

    tableToolTile.getTableTitle().should('contain', title);
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getTableCell().eq(1).should('contain', '5');
      tableToolTile.getTableCell().eq(2).should('contain', '2.5');
      tableToolTile.getTableRow().should('have.length', 2);
    });

    tableToolTile.getTableTile().click();
    cy.log('delete button works');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getTableCell().eq(1).should('contain', '5');
      clueCanvas.clickToolbarButton('table', 'delete');
      tableToolTile.getTableCell().eq(1).should('contain', '');
    });

    cy.log('will toggle index numbers');
    tableToolTile.getIndexNumberToggle().click();
    cy.get(".primary-workspace").within(() => {
      cy.get(".index-cell-contents").eq(0).should('contain', 1);
      cy.get(".index-cell-contents").eq(1).should('contain', "");
    });

    cy.log('will remove a row');
    tableToolTile.removeRow("0");
    tableToolTile.getTableRow().should('have.length', 1);
    cy.get(".index-cell-contents").eq(0).should('contain', "");

    cy.log('will verify formula modal');
    clueCanvas.clickToolbarButton('table', 'set-expression');
    cy.get('.modal-title').should('contain', "Set Expression");
    cy.get('.modal-content .prompt select').should('not.exist');
    cy.get('.modal-content .prompt').should('contain', "y");

    cy.log('will enter a formula');
    cy.get('#expression-input').click().type(formula + '{enter}');
    cy.get('.ReactModalPortal').should('not.exist');

    cy.log('verify formula appears under correct column header');
    cy.get('.editable-header-cell')
      .filter(':has(.header-name:contains("y"))')
      .parent()
      .siblings('.expression-cell.has-expression')
      .should('contain', formula);

    cy.log('verify selection of y axis when there is more than one');
    cy.get(".primary-workspace").within((workspace) => {
      tableToolTile.getAddColumnButton().click();
      tableToolTile.renameColumn('y', headerY); //makes it easier to find the correct column header
      clueCanvas.clickToolbarButton('table', 'set-expression');
    });
    cy.get('.modal-title').should('contain', "Set Expression");
    cy.get('.modal-content .prompt select').should('exist');
    cy.get('.modal-content .prompt select').select(headerY);
    cy.get('.expression label').should('contain', headerY);

    cy.log('verify clear button functionality');
    cy.get('.modal-button').contains('Clear').click();
    cy.get('#expression-input').should('not.contain', formula);

    cy.log('verify cancel does not enter in a formula');
    cy.get('#expression-input').click().type(formula);
    cy.get('.modal-button').contains('Cancel').click();
    cy.get('.editable-header-cell')
      .contains(headerY) // y2 also contains "y" so this no longer works
      .first()
      .siblings('.expression-cell.has-expression')
      .should('not.exist');

    cy.log('verify selection of y2 axis and will enter a formula');
    clueCanvas.clickToolbarButton('table', 'set-expression');
    cy.get('.modal-title').should('contain', "Set Expression");
    cy.get('.modal-content .prompt select').should('exist');
    cy.get('.modal-content .prompt select').select('y2');
    cy.get('.modal-content .prompt').should('contain', 'y2');
    cy.get('#expression-input').click().type(`${headerX}+2{enter}`);

    cy.log('verify value calculated based on formula correctly');
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

    cy.log('verifies restore of table field content in copy document');
    const tableTitle = "table test";
    //copy investigation
    canvas.copyDocument(copyTitle);
    cy.wait(1000);
    canvas.getPersonalDocTitle().should('contain', copyTitle);
    tableToolTile.getTableTitle().should('contain', tableTitle);
    tableToolTile.getTableCell().eq(1).should('contain', '5');
    tableToolTile.getTableCell().eq(2).should('contain', '17');
    tableToolTile.getTableCell().eq(3).should('contain', '7');

    cy.get(".primary-workspace").within((workspace) => {
      cy.get('.editable-header-cell')
        .filter(':has(.header-name:contains("mars"))')
        .parent()
        .siblings('.expression-cell.has-expression')
        .should('contain', formula);
    });

    canvas.deleteDocument();

    cy.log('verify delete table');
    tableToolTile.getTableTile().click();
    clueCanvas.deleteTile('table');
  });

  it('Table Tool Tile Undo Redo', function () {
    beforeTest();

    cy.log('will undo redo table tile creation/deletion');
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

    cy.log('will undo redo table field content');
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

    cy.log('verify delete table');
    tableToolTile.getTableTile().click();
    clueCanvas.deleteTile('table');

    cy.log('will link to an XY Plot using the "View Data as Graph" button');
    clueCanvas.addTile('table');
    tableToolTile.typeInTableCell(1, '5');
    tableToolTile.typeInTableCell(2, '2.5');
    tableToolTile.typeInTableCell(5, '4');
    tableToolTile.typeInTableCell(6, '7');
    clueCanvas.clickToolbarButton('table', 'link-graph');
    tableToolTile.getLinkGraphModalTileMenu().select('New Graph');
    tableToolTile.getLinkGraphModalLinkButton().should("contain", "Graph It!").click();
    xyplot.getTile().should("exist").contains("Table Data 1");

    cy.log('can unlink and link data from a table using the "Link Table" button');
    // Unlink
    clueCanvas.clickToolbarButton('table', 'link-tile');
    tableToolTile.getLinkGraphModalTileMenu().select('Graph 1');
    tableToolTile.getLinkGraphModalLinkButton().should("contain", "Clear It!").click();
    // Re-link
    clueCanvas.clickToolbarButton('table', 'link-tile');
    tableToolTile.getLinkGraphModalTileMenu().select('Graph 1');
    tableToolTile.getLinkGraphModalLinkButton().should("contain", "Link").click();
  });

  it('should handle table sorting with mixed data types', function() {
    beforeTest();

    // Load test data
    cy.fixture('table-sort-test-data.json').then((testData) => {
      // Add table to canvas
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');

      // Fill table with test data
      // Start with two columns: x and y
      tableToolTile.renameColumn('x', 'Name');
      tableToolTile.renameColumn('y', 'Age');

      // Add two more columns
      tableToolTile.getAddColumnButton().click(); // now 3 columns
      tableToolTile.renameColumn('y', 'Score');
      tableToolTile.getAddColumnButton().click(); // now 4 columns
      tableToolTile.renameColumn('y', 'Notes');

      // Now fill the table
      tableToolTile.fillTable(tableToolTile.getTableTile(), testData.mixedData);

      cy.get('.sort-column-button').each(($btn) => {
        cy.wrap($btn).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Not sorted');
      });

      // Test sorting on Name column (text)
      cy.log('Testing text column sorting');
      // Select Name column (index 0) and sort ascending
      tableToolTile.getColumnHeader().eq(0).click();
      cy.get('.sort-column-button').eq(0).click();
      cy.get('.sort-column-button').eq(0).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted ascending');
      testData.expectedSorts.name.asc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 2).should('contain', expectedValue);
      });
      // Sort descending
      cy.get('.sort-column-button').eq(0).click();
      cy.get('.sort-column-button').eq(0).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted descending');
      testData.expectedSorts.name.desc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 2).should('contain', expectedValue);
      });

      // Test sorting on Age column (numeric)
      cy.log('Testing numeric column sorting');
      tableToolTile.getColumnHeader().eq(1).click();
      cy.get('.sort-column-button').eq(1).click();
      cy.get('.sort-column-button').eq(1).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted ascending');
      testData.expectedSorts.age.asc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 3).should('contain', expectedValue);
      });
      // Sort descending
      cy.get('.sort-column-button').eq(1).click();
      cy.get('.sort-column-button').eq(1).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted descending');
      testData.expectedSorts.age.desc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 3).should('contain', expectedValue);
      });

      // Test sorting on Score column (decimal)
      cy.log('Testing decimal column sorting');
      tableToolTile.getColumnHeader().eq(2).click();
      cy.get('.sort-column-button').eq(2).click();
      cy.get('.sort-column-button').eq(2).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted ascending');
      testData.expectedSorts.score.asc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 4).should('contain', expectedValue);
      });

      // Sort descending
      cy.get('.sort-column-button').eq(2).click();
      cy.get('.sort-column-button').eq(2).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted descending');
      testData.expectedSorts.score.desc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 4).should('contain', expectedValue);
      });

      // Test sorting on Notes column (text)
      cy.log('Testing Notes column sorting');
      tableToolTile.getColumnHeader().eq(3).click();
      cy.get('.sort-column-button').eq(3).click();
      cy.get('.sort-column-button').eq(3).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted ascending');
      testData.expectedSorts.notes.asc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 5).should('contain', expectedValue);
      });
      // Sort descending
      cy.get('.sort-column-button').eq(3).click();
      cy.get('.sort-column-button').eq(3).find('[data-testid^="sort-indicator-"]').should('have.attr', 'aria-label', 'Sorted descending');
      testData.expectedSorts.notes.desc.forEach((expectedValue, index) => {
        tableToolTile.getTableCellWithRowColIndex(index, 5).should('contain', expectedValue);
      });

      // Click away from the table (e.g., click the workspace background)
      cy.get('body').click(0, 0); // or another selector outside the table

      // Assert the sort indicator is still "Sorted descending"
      cy.get('.sort-column-button').eq(3).find('[data-testid^="sort-indicator-"]')
        .should('have.attr', 'aria-label', 'Sorted descending');
    });
  });
});
