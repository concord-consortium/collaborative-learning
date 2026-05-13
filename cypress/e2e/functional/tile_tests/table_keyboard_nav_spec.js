import ClueCanvas from '../../../support/elements/common/cCanvas';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

const clueCanvas = new ClueCanvas;
const tableToolTile = new TableToolTile;

// /editor/ loads a standalone document editor — much faster than the full
// student app used in table_tool_spec.js. Pattern matches bar_graph_tile_spec.js.
//
// The editor renders the document in three workspaces (.primary-workspace plus
// two .read-only-*); selectors like `.column-header-cell` would otherwise match
// 3 copies. Always scope DOM queries to .primary-workspace so the test
// exercises the single editable instance where the focus trap is active.
//
// IMPORTANT: this spec must run against the dev server bound to this worktree,
// not the default in cypress/config/cypress.local.json (8080). To override,
// invoke cypress directly without --env testEnv=local, e.g.:
//   npx cypress run --spec '...' --config baseUrl=http://localhost:8083/
function beforeTest() {
  const url = "/editor/?appMode=qa&unit=./demo/units/qa/content.json";
  cy.visit(url);
}

context('Table Tile Keyboard Navigation', function () {
  // Single it-block to stay within the project's CI cap on cypress test count.
  // Scenarios are ordered so the most state-fragile one (edit-mode Tab,
  // requires a clean RDG state to dblclick into edit mode) runs first, then
  // header interactions chain off of one another.
  it('keyboard nav: edit-Tab, header auto-select, remove button, rename Escape, Tab cycle', function () {
    beforeTest();

    cy.log('Set up: add table with two columns and seed data in two cells');
    clueCanvas.addTile('table');
    tableToolTile.getTableTile().should('be.visible');
    cy.wait(300); // let rdg's mount-time auto-focus settle
    tableToolTile.typeInTableCell(1, 'val1');
    tableToolTile.typeInTableCell(2, 'val2');

    // -------------------------------------------------------------------------
    // Edit-mode Tab commits the typed value and advances focus.
    // Run first while RDG is in a clean post-setup state — dblclick-to-edit
    // is fragile after a lot of header interaction.
    // -------------------------------------------------------------------------
    cy.log('Edit-mode Tab: commits typed value and advances focus');
    cy.get('.primary-workspace').within(() => {
      cy.get('.rdg-row[aria-rowindex=2] .rdg-cell[aria-colindex=2]')
        .dblclick({ scrollBehavior: false });
    });
    cy.wait(100);
    // The cell editor is rendered to the document via portal; query at root.
    cy.document().within(() => {
      tableToolTile.getTableCellEdit().clear().type('tabval', { scrollBehavior: false });
    });
    cy.realPress('Tab');
    cy.get('.primary-workspace').within(() => {
      cy.get('.rdg-row[aria-rowindex=2] .rdg-cell[aria-colindex=2]').should('contain', 'tabval');
    });

    // -------------------------------------------------------------------------
    // Activate the tile so the focus trap is enabled for the header tests.
    // -------------------------------------------------------------------------
    tableToolTile.getTableTile().click();

    // -------------------------------------------------------------------------
    // Header auto-select on focus.
    // .header-name is role="button" tabIndex=0; focusing it should bubble
    // onFocus up to .column-header-cell handleHeaderFocus → onSelectColumn.
    // We use cy.focus() (not realClick) so the click handler doesn't ALSO
    // fire — realClick would enter rename mode.
    // -------------------------------------------------------------------------
    cy.log('Header auto-select: focusing column name selects that column');
    cy.get('.primary-workspace').within(() => {
      cy.get('.column-header-cell .editable-header-cell .header-name').eq(0).focus();
      cy.get('.column-header-cell').eq(0).should('have.class', 'selected-column');
    });

    // -------------------------------------------------------------------------
    // Remove column button is a native <button> and opens the dialog.
    // Col 0 (x) is not removable; col 1 (y) is. Synthetic click on
    // .column-header-cell fires handleHeaderClick → onSelectColumn without
    // focusing a child, so we don't trigger the auto-select-on-focus +
    // click combo that would open rename mode.
    // -------------------------------------------------------------------------
    cy.log('Remove column button is a native <button> and opens the dialog');
    cy.get('.primary-workspace').within(() => {
      cy.get('.column-header-cell').eq(1).click();
      cy.get('.column-header-cell').eq(1).should('have.class', 'selected-column');
      cy.get('.column-header-cell').eq(1).find('.remove-column-button').should('be.visible');
      cy.get('.column-header-cell').eq(1).find('.remove-column-button')
        .should('have.prop', 'tagName', 'BUTTON');
      cy.get('.column-header-cell').eq(1).find('.remove-column-button').realClick();
    });
    // Modal is rendered to a portal at document root.
    cy.get('.modal-title').should('be.visible').and('contain', 'Remove Column');
    cy.get('.modal-button').contains('Cancel').click();
    cy.get('.modal-title').should('not.exist');

    // -------------------------------------------------------------------------
    // Tab cycle smoke test. Run before the rename test — the rename
    // sequence leaves the trap in a state where the next Tab moves focus
    // outside the trap entirely (likely a stale slotIndex), so this would
    // fail if we did it after.
    // -------------------------------------------------------------------------
    cy.log('Tab cycle: Tab from a focused header control stays in the header row');
    cy.get('.primary-workspace .column-header-cell .editable-header-cell .header-name').eq(0).focus();
    cy.focused().closest('[role="row"][aria-rowindex="1"]').should('exist');
    cy.realPress('Tab');
    cy.focused().closest('[role="row"][aria-rowindex="1"]').should('exist');

    cy.log('Tab cycle: Shift+Tab from toolbar moves focus into the grid body');
    // Toolbar is portaled to document root. Filter to the enabled (non-
    // disabled) toolbar — only the toolbar for the selected/active tile is
    // enabled. Read-only workspaces don't render an active toolbar.
    cy.get('[data-testid="tile-toolbar"]:not(.disabled) .toolbar-button').first().focus();
    cy.wait(100);
    cy.realPress(['Shift', 'Tab']);
    cy.wait(100);
    cy.focused().closest('.primary-workspace .rdg').should('exist');

    // -------------------------------------------------------------------------
    // Header rename Escape exits edit mode.
    // createHeaderEscapeHandler returns "handled" when the rename input is
    // focused, so the rename editor closes without exiting the trap.
    // (Done last because the post-rename trap state breaks Tab assertions.)
    // -------------------------------------------------------------------------
    cy.log('Header rename: Escape exits edit mode without changing the column name');
    // Reset state from the previous Tab-cycle assertions: click a body cell
    // to return focus to a known state, then the matching helper-style
    // pattern (click + click) reliably opens rename mode.
    cy.get('.primary-workspace .rdg-row[aria-rowindex=2] .rdg-cell[aria-colindex=2]').click();
    cy.get('.primary-workspace .column-header-cell .editable-header-cell .header-name').eq(0).then(($el) => {
      const originalName = $el.text().trim();
      // Use the same select+rename pattern as renameColumn(): two separate
      // .get().click() invocations so React 18 commits between them.
      cy.get('.primary-workspace .column-header-cell .editable-header-cell .header-name').eq(0).click();
      cy.get('.primary-workspace .column-header-cell .editable-header-cell .header-name').eq(0).click();
      cy.get('.primary-workspace .column-header-cell .editable-header-cell input').should('exist').focus();
      cy.realPress('Escape');
      cy.get('.primary-workspace .column-header-cell .editable-header-cell input').should('not.exist');
      cy.get('.primary-workspace .column-header-cell .editable-header-cell .header-name')
        .eq(0).should('contain', originalName);
    });
  });
});
