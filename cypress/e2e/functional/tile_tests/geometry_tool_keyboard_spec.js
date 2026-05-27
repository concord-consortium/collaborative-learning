import ClueCanvas from '../../../support/elements/common/cCanvas';
import GeometryToolTile from '../../../support/elements/tile/GeometryToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

const clueCanvas = new ClueCanvas();
const geometryTile = new GeometryToolTile();
const tableToolTile = new TableToolTile();

context('Coordinate Grid keyboard accessibility', function () {
  beforeEach(function () {
    cy.visit('/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&problem=1.1&unit=qa&noStorage');
    cy.waitForLoad();
    clueCanvas.addTile('geometry');
  });

  function selectGeometryTile() {
    // Click the outer `.geometry-tool-tile` wrapper to select the tile, then
    // explicitly focus it. The click alone doesn't reliably leave focus on the
    // outer wrapper because clicks land on the centermost descendant — which
    // for the geometry tile is the JSXGraph SVG (tabindex=0 grabs focus on
    // click). The subsequent Enter then needs focus on `.tool-tile` to trigger
    // `tile-component.handleKeyDown`'s `enterTrap()` branch.
    cy.get('.primary-workspace .canvas-area .geometry-tool-tile')
      .click()
      .focus();
    cy.realPress('Enter');
    cy.focused().should('have.class', 'editable-tile-title-text');
  }

  // The empty Coordinate Grid tile has this trap cycle:
  //   title → SVG board (content) → toolbar (single tab stop) → resize → wrap.
  // The SVG board is the JSXGraph root, decorated with role="group" + tabindex="0"
  // in handleCreateBoard so the trap visits it as the sole content tab stop.
  // The toolbar uses the standard CLUE pattern of one tab stop + internal arrow-key
  // roving via useRovingTabindex.
  const emptyFocusOrder = [
    ['css',   '.geometry-content [role="group"]'],  // JSXGraph SVG root
    ['class', 'toolbar-button'],                    // first toolbar button
    ['class', 'tool-tile-resize-handle-wrapper'],   // resize handle
  ];

  function assertFocused([attr, value]) {
    if (attr === 'class') cy.focused().should('have.class', value);
    else if (attr === 'css') cy.focused().should('match', value);
    else if (value === '') cy.focused().should('have.attr', attr);
    else cy.focused().should('have.attr', attr, value);
  }

  it('Empty Coordinate Grid — focus trap, title editing, toolbar contracts, color palette, polygon seed', function () {
    selectGeometryTile();

    cy.log('Tab cycles forward through every focus slot, then wraps to title');
    emptyFocusOrder.forEach(entry => {
      cy.realPress('Tab');
      assertFocused(entry);
    });
    cy.realPress('Tab');
    cy.focused().should('have.class', 'editable-tile-title-text');

    cy.log('Shift+Tab cycles in reverse, then wraps to title');
    [...emptyFocusOrder].reverse().forEach(entry => {
      cy.realPress(['Shift', 'Tab']);
      assertFocused(entry);
    });
    cy.realPress(['Shift', 'Tab']);
    cy.focused().should('have.class', 'editable-tile-title-text');

    cy.log('Escape exits the trap to the .tool-tile container');
    cy.realPress('Tab'); // title → SVG board
    cy.realPress('Escape');
    cy.focused().should('have.class', 'tool-tile');

    cy.log('Enter on the focused title opens the inline editor; Escape cancels');
    selectGeometryTile();
    cy.realPress('Enter');
    cy.get('.geometry-tool .editable-tile-title input').should('be.visible').type('Renamed');
    cy.realPress('Escape');
    cy.get('.geometry-tool .editable-tile-title input').should('not.exist');
    cy.focused().should('have.class', 'editable-tile-title-text');

    cy.log('Enter again opens the editor; typing + Enter commits the new title');
    cy.realPress('Enter');
    cy.get('.geometry-tool .editable-tile-title input').clear().type('My grid');
    cy.realPress('Enter');
    cy.get('.geometry-tool .editable-tile-title input').should('not.exist');
    cy.get('.geometry-tool .editable-tile-title-text').should('contain.text', 'My grid');
    cy.focused().should('have.class', 'editable-tile-title-text');

    cy.log('Each toolbar button exposes a non-empty aria-label');
    cy.get('.tile-toolbar.geometry-toolbar .toolbar-button')
      .should('have.length.greaterThan', 0)
      .each($el => {
        expect($el.attr('aria-label'), 'aria-label set').to.not.be.empty;
      });

    cy.log('Mode buttons reflect on/off state via aria-pressed (Select is default)');
    cy.get('button.toolbar-button.select')
      .should('have.attr', 'aria-pressed', 'true');
    cy.get('button.toolbar-button.point')
      .should('have.attr', 'aria-pressed', 'false');

    cy.log('Disabled toolbar buttons use aria-disabled (still keyboard-focusable)');
    cy.get('button.toolbar-button.duplicate')
      .should('have.attr', 'aria-disabled', 'true')
      .and('not.have.attr', 'disabled');

    cy.log('Mouse click on the Point button flips mode but does NOT seed (detail===1)');
    cy.get('button.toolbar-button.point').click();
    cy.get('button.toolbar-button.point').should('have.attr', 'aria-pressed', 'true');
    geometryTile.getGraphPoint().should('have.length', 0);
    clueCanvas.clickToolbarButton('geometry', 'select'); // restore Select mode

    cy.log('Enter on the Color button opens the palette with role=group + aria-label; focus on a swatch');
    cy.get('button.toolbar-button.color').focus();
    cy.realPress('Enter');
    cy.get('.color-palette').should('be.visible')
      .and('have.attr', 'role', 'group')
      .and('have.attr', 'aria-label', 'Color picker');
    cy.focused()
      .should('have.attr', 'role', 'button')
      .and('have.class', 'color-swatch');

    cy.log('Each swatch exposes aria-label and aria-pressed');
    cy.get('.color-swatch[role="button"]').each($el => {
      expect($el.attr('aria-label'), 'aria-label non-empty').to.not.be.empty;
      expect($el.attr('aria-pressed'), 'aria-pressed set').to.match(/^(true|false)$/);
    });

    cy.log('Escape closes the palette and returns focus to the Color button');
    cy.realPress('Escape');
    cy.get('.color-palette').should('not.exist');
    cy.focused().should('have.class', 'toolbar-button').and('have.class', 'color');

    cy.log('Keyboard Enter on the Polygon button seeds a unit-square (4 vertices + 1 polygon)');
    // Representative coverage of the toolbar-Enter → seed-shape pipeline.
    // Per-shape branch coverage (point, polygon, circle, line) lives in
    // src/components/tiles/geometry/geometry-keyboard-create.test.ts.
    // Scope to `.show-tile` — the navigator mini-map renders a `.show-all`
    // copy of the same content that would double every count.
    cy.get('button.toolbar-button.polygon').focus();
    cy.realPress('Enter');
    cy.get('.geometry-content.show-tile polygon[data-object-id]').should('have.length', 1);
    cy.get('.geometry-content.show-tile ellipse[data-object-id]').should('have.length', 4);

    cy.log('The seeded polygon\'s rendNode carries a "Polygon ... with N vertices" aria-label');
    cy.get('.geometry-content.show-tile polygon[data-object-id]')
      .invoke('attr', 'aria-label')
      .should('match', /^Polygon .*with 4 vertices/);

    cy.log('Each vertex carries a "Vertex k of N of polygon ..." aria-label');
    cy.get('.geometry-content.show-tile ellipse[data-object-id][aria-label*="Vertex"]')
      .should('have.length.greaterThan', 0)
      .each($el => {
        expect($el.attr('aria-label'), 'vertex label format')
          .to.match(/^Vertex \d+ of \d+ of polygon /);
      });
  });

  context('Free-point selection and movement', function () {
    beforeEach(function () {
      // Switch to Point mode so board clicks realize free points. (Select mode
      // treats board clicks as deselect.)
      clueCanvas.clickToolbarButton('geometry', 'point');
      geometryTile.clickGraphPosition(3, 4);
      geometryTile.clickGraphPosition(5, 5);
      geometryTile.clickGraphPosition(6, 7);
      // Return to Select mode so the focus-trap flow isn't biased by point-mode
      // clicks landing on the title's editable surface.
      clueCanvas.clickToolbarButton('geometry', 'select');
    });

    it('Tab walks board → points; Enter / Shift+Enter / replace; ArrowRight nudge; announcer', function () {
      selectGeometryTile();

      cy.log('From the title, Tab walks the SVG board, then each point in DOM order');
      cy.realPress('Tab'); // title → SVG board
      cy.focused().should('match', '.geometry-content [role="group"]');
      const collected = [];
      cy.realPress('Tab');
      cy.focused().then($el => collected.push($el.attr('data-object-id') ?? ''));
      cy.realPress('Tab');
      cy.focused().then($el => collected.push($el.attr('data-object-id') ?? ''));
      cy.realPress('Tab');
      cy.focused().then($el => collected.push($el.attr('data-object-id') ?? ''))
        .then(() => {
          expect(collected.filter(Boolean), 'each Tab landed on a focusable geometry object')
            .to.have.length(3);
        });

      // After three forward Tabs, focus is on point[2]. Shift+Tab twice to reach point[0].
      cy.realPress(['Shift', 'Tab']);
      cy.realPress(['Shift', 'Tab']);

      cy.log('Enter on focused point flips aria-pressed and triggers the aria-live announcer');
      cy.focused().should('have.attr', 'aria-pressed', 'false');
      cy.realPress('Enter');
      cy.focused().should('have.attr', 'aria-pressed', 'true');
      // The double-rAF debounce in announceGeometry posts the message after a
      // microtask + two frames. Cypress auto-retry synchronises with it.
      cy.get('[data-grid-announcer]').should('contain.text', 'Selected');

      cy.log('Shift+Enter on a second point extends the selection (both stay selected)');
      cy.realPress('Tab'); // → point[1]
      cy.realPress(['Shift', 'Enter']);
      cy.focused().should('have.attr', 'aria-pressed', 'true');
      cy.get('.geometry-content.show-tile [data-object-id][aria-pressed="true"]').should('have.length', 2);

      cy.log('Plain Enter on a third focused point replaces the existing selection');
      cy.realPress('Tab'); // → point[2]
      cy.realPress('Enter');
      cy.focused().should('have.attr', 'aria-pressed', 'true');
      cy.get('.geometry-content.show-tile [data-object-id][aria-pressed="true"]').should('have.length', 1);

      cy.log('ArrowRight nudges the focused selected point (+0.1 user-units → +cx px)');
      cy.focused().then($el => {
        const initialCx = parseFloat($el.attr('cx') ?? '0');
        cy.realPress('ArrowRight');
        cy.focused().should('have.attr', 'aria-pressed', 'true');
        cy.focused().then($el2 => {
          const newCx = parseFloat($el2.attr('cx') ?? '0');
          expect(newCx - initialCx, 'cx increased after ArrowRight nudge').to.be.greaterThan(0);
        });
      });
    });
  });

  context('Linked Table integration', function () {
    beforeEach(function () {
      // The Add Data button enables itself when ANY linkable shared model
      // (SharedDataSet) is registered in the document; an empty Table tile is
      // sufficient. Rows are populated later, just before linking.
      clueCanvas.addTile('table');
    });

    it('Add Data dialog opens with focus inside; linked points are tab stops; Enter selects', function () {
      cy.log('Enter on the Add Data button opens the link-tile dialog with focus inside');
      geometryTile.getGeometryTile().click();
      cy.get('button.toolbar-button.add-data').focus();
      cy.realPress('Enter');
      cy.get('.custom-modal.link-tile').should('be.visible');
      cy.focused().then($el => {
        expect($el.closest('.custom-modal').length, 'focused element is inside the dialog')
          .to.be.greaterThan(0);
      });

      cy.log('Escape closes the dialog');
      cy.realPress('Escape');
      cy.get('.custom-modal.link-tile').should('not.exist');

      cy.log('Populate the Table with three rows and link it to the geometry tile');
      cy.get('.primary-workspace').within(() => {
        tableToolTile.typeInTableCell(1, '1{enter}');
        tableToolTile.typeInTableCell(2, '2{enter}');
        tableToolTile.typeInTableCell(5, '3{enter}');
        tableToolTile.typeInTableCell(6, '4{enter}');
        tableToolTile.typeInTableCell(9, '5{enter}');
        tableToolTile.typeInTableCell(10, '6{enter}');
      });
      cy.linkTableToTile('Table Data 1', 'Coordinate Grid 1');

      cy.log('Each linked point carries "Linked point" aria-label, role=button, and is a Tab stop');
      cy.get('.geometry-content [data-object-id]')
        .filter('[aria-label^="Linked point"]')
        .should('have.length.at.least', 3)
        .each($el => {
          expect($el.attr('tabindex'), 'tabindex on linked rendNode').to.equal('0');
          expect($el.attr('role'), 'role=button on linked rendNode').to.equal('button');
        });

      cy.log('From the title, Tab walks SVG board → first linked point with proper aria');
      selectGeometryTile();
      cy.realPress('Tab'); // title → SVG board
      cy.focused().should('match', '.geometry-content [role="group"]');
      cy.realPress('Tab'); // → first linked point
      cy.focused().should('have.attr', 'data-object-id').and('not.be.empty');
      cy.focused()
        .invoke('attr', 'aria-label')
        .should('match', /^Linked point at /);

      cy.log('Enter on a focused linked point flips its aria-pressed to "true"');
      cy.focused().should('have.attr', 'aria-pressed', 'false');
      cy.realPress('Enter');
      cy.focused().should('have.attr', 'aria-pressed', 'true');
    });
  });

  context('Read-only mode', function () {
    // The `/editor/` route renders three workspaces side-by-side: the editable
    // primary, plus `.read-only-local-workspace` and `.read-only-remote-workspace`.
    // We exercise the `type: "region"` path via `.read-only-local-workspace`.
    beforeEach(function () {
      cy.visit('/editor/?appMode=qa&unit=./demo/units/qa/content.json');
      cy.get('.editable-document-content', { timeout: 60000 });
      clueCanvas.addTile('geometry');
      // Switch to Point mode so board clicks realize free points (Select treats
      // clicks as deselect rather than create).
      clueCanvas.clickToolbarButton('geometry', 'point');
      geometryTile.clickGraphPosition(3, 4);
      geometryTile.clickGraphPosition(6, 7);
    });

    function readOnlyTile() {
      return cy.get('.read-only-local-workspace .geometry-tool-tile');
    }

    it('Read-only Coordinate Grid exposes accessible scaffold without editing affordances', function () {
      cy.log('Board objects render but are NOT keyboard tab stops in read-only mode');
      readOnlyTile().find('.geometry-content svg ellipse').should('have.length.greaterThan', 0);
      readOnlyTile().find('.geometry-content [role="button"]').should('not.exist');
      readOnlyTile().find('.geometry-content [data-object-id]').should('not.exist');

      cy.log('SVG board container exposes role=group + tabindex (single content entry)');
      readOnlyTile()
        .find('.geometry-content [role="group"]')
        .should('exist')
        .and('have.attr', 'tabindex', '0');

      cy.log('Aria-live announcer is still rendered');
      readOnlyTile()
        .find('[data-grid-announcer]')
        .should('exist')
        .and('have.attr', 'aria-live', 'polite');

      cy.log('Read-only title is focusable but has no "editable title" aria suffix');
      readOnlyTile()
        .find('.editable-tile-title-text')
        .should('have.attr', 'tabindex', '0')
        .invoke('attr', 'aria-label')
        .should('not.match', /editable title/);
    });
  });
});
