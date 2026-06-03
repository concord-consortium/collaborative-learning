import ClueCanvas from '../../../support/elements/common/cCanvas';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

const clueCanvas = new ClueCanvas;
const xyTile = new XYPlotToolTile;
const tableToolTile = new TableToolTile;

context('XY Plot keyboard accessibility', function () {
  beforeEach(function () {
    // Use the local qa unit's content.json rather than the bare `unit=qa`
    // shorthand. The shorthand resolves to a remote qa unit in CODAP-legend
    // mode (defaultSeriesLegend=false); the local file is CLUE-legend mode
    // (defaultSeriesLegend=true), which is what these tests assume (Enter on
    // an axis label starts an inline edit rather than opening the attr menu).
    cy.visit('/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5'
      + '&unit=./demo/units/qa/content.json&noStorage');
    cy.waitForLoad();
    clueCanvas.addTile('graph');
  });

  function selectGraphTile() {
    xyTile.getTile().click();
    cy.realPress('Enter');
    cy.focused().should('have.class', 'editable-tile-title-text');
  }

  // The empty XY-Plot in qa unit (CLUE-legend mode) has this trap cycle:
  //   title → X-label → Y-label → X-min → X-max → Y-min → Y-max
  //         → add-series (palette) → toolbar → drag handle → resize → wrap.
  //  - The dots-group surrogate is in the DOM but 0×0 on an empty plot, so the
  //    trap's visibility filter skips it. Once a dataset is linked it becomes
  //    a real Tab stop (between the labels and the min/max bound controls).
  //  - The axis min/max bound controls (`.editable-border-box`) are
  //    absolutely-positioned HTML divs that live inside the trap's content
  //    slot via the `.graph-content-area` wrapper.
  //  - The legend palette always renders AddSeriesButton; it's aria-disabled
  //    until a linkable dataset exists but stays focusable, so the trap visits it.
  //  - The toolbar is a single Tab stop with internal arrow-key roving
  //    (useRovingTabindex). Direction-agnostic match: forward Tab lands on
  //    the first button (link-tile-multiple); reverse from the resize handle
  //    lands on the last (toggle-lock). Both still match `toolbar-button`.
  //    The specific "first button is link-tile-multiple" assertion lives in
  //    the ArrowRight roving section below.
  const emptyFocusOrder = [
    ['class', 'axis-label'],                         // X-axis label (bottom)
    ['class', 'axis-label'],                         // Y-axis label (left)
    ['class', 'editable-border-box'],                // X-axis min
    ['class', 'editable-border-box'],                // X-axis max
    ['class', 'editable-border-box'],                // Y-axis min
    ['class', 'editable-border-box'],                // Y-axis max
    ['class', 'add-series-button'],                  // legend palette
    ['class', 'toolbar-button'],                     // toolbar (either end of the roving range)
    ['class', 'tool-tile-drag-handle-wrapper'],      // drag handle
    ['class', 'tool-tile-resize-handle-wrapper'],    // resize handle
  ];

  function assertFocused([attr, value]) {
    if (attr === 'class') cy.focused().should('have.class', value);
    else if (value === '') cy.focused().should('have.attr', attr);
    else cy.focused().should('have.attr', attr, value);
  }

  it('Empty XY Plot — tab cycling, axis-label editing, surrogate scaffold, toolbar contracts', function () {
    selectGraphTile();

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
    cy.realPress('Tab'); // → X-axis label
    cy.realPress('Escape');
    cy.focused().should('have.class', 'tool-tile');

    cy.log('X-axis label exposes the "press Enter to edit" affordance in aria-label');
    selectGraphTile(); // re-enter trap
    cy.realPress('Tab'); // → X-axis
    cy.focused()
      .should('have.class', 'axis-label')
      .invoke('attr', 'aria-label')
      .should('match', /^X-axis label: .*, press Enter to edit$/);

    cy.log('Enter opens inline editor; Escape cancels without committing');
    cy.realPress('Enter');
    xyTile.getXAxisLabel().should('have.class', 'editing');
    xyTile.getXAxisInput().should('be.visible');
    xyTile.getXAxisInput().type('Throwaway');
    cy.realPress('Escape');
    xyTile.getXAxisLabel().should('not.have.class', 'editing');
    xyTile.getXAxisLabel().should('not.contain.text', 'Throwaway');
    cy.focused().should('have.class', 'axis-label').and('have.class', 'bottom');

    cy.log('Typing then Enter commits the new label and returns focus to the trigger');
    cy.realPress('Enter'); // re-open editor
    xyTile.getXAxisInput().clear().type('Width{enter}');
    xyTile.getXAxisLabel().should('contain.text', 'Width');
    cy.focused().should('have.class', 'axis-label').and('have.class', 'bottom');

    cy.log('Tabbing past the Y-axis label lands on the X-axis min bound control');
    cy.realPress('Tab'); // → Y-axis label
    cy.realPress('Tab'); // → X-axis min (first .editable-border-box in DOM order)
    cy.focused()
      .should('have.attr', 'data-testid', 'editable-border-box-bottom-min')
      .invoke('attr', 'aria-label')
      .should('match', /^X-axis minimum: .*, press Enter to edit$/);

    cy.log('Enter on a focused bound opens its numeric editor; Escape cancels and returns focus');
    cy.realPress('Enter');
    cy.get('[data-testid="editable-border-box-bottom-min"] .input-textbox').should('be.visible');
    cy.realPress('Escape');
    cy.focused().should('have.attr', 'data-testid', 'editable-border-box-bottom-min');

    cy.log('Dots-group surrogate and aria-live announcer scaffolding are present');
    xyTile.getTile()
      .find('[data-graph-dots-group]')
      .should('exist')
      .and('have.attr', 'tabindex', '0')
      .and('have.attr', 'role', 'group')
      .invoke('attr', 'aria-label')
      .should('contain', 'Data points');
    xyTile.getTile()
      .find('[data-graph-announcer]')
      .should('exist')
      .and('have.attr', 'aria-live', 'polite');

    cy.log('Toolbar buttons: aria-label per button; disabled use aria-disabled (not HTML disabled)');
    const toolbarExpected = [
      ['link-tile-multiple', 'Add data'],
      ['fit-all',            'Fit All'],
      ['toggle-lock',        'Lock Axes'],
    ];
    toolbarExpected.forEach(([name, label]) => {
      cy.get(`button.toolbar-button.${name}`)
        .invoke('attr', 'aria-label').should('eq', label);
    });
    cy.get('button.toolbar-button.link-tile-multiple')
      .invoke('attr', 'aria-disabled').should('eq', 'true');
    cy.get('button.toolbar-button.link-tile-multiple')
      .should('not.have.attr', 'disabled');

    cy.log('ArrowRight roves within the toolbar; Enter on fit-all activates without throwing');
    // Currently inside the trap with focus on X-axis min (from the bound-edit
    // section above). Tab forward through remaining content focusables
    // (X-max, Y-min, Y-max), then through the palette to the toolbar.
    cy.realPress('Tab'); // → X-axis max
    cy.realPress('Tab'); // → Y-axis min
    cy.realPress('Tab'); // → Y-axis max
    cy.realPress('Tab'); // → add-series (palette)
    cy.realPress('Tab'); // → first toolbar button (link-tile-multiple)
    cy.focused().should('have.class', 'link-tile-multiple');
    cy.realPress('ArrowRight'); // roving → fit-all
    cy.focused().should('have.class', 'toolbar-button').and('have.class', 'fit-all');
    // fit-all is an immediate-action button — no observable side effect on an
    // empty graph (no data to scale), but the activation should not throw.
    cy.realPress('Enter');
    cy.focused().should('have.class', 'toolbar-button').and('have.class', 'fit-all');

    cy.log('toggle-lock flips aria-pressed when activated');
    cy.get('button.toolbar-button.toggle-lock')
      .invoke('attr', 'aria-pressed').should('eq', 'false');
    cy.get('button.toolbar-button.toggle-lock').click();
    cy.get('button.toolbar-button.toggle-lock')
      .invoke('attr', 'aria-pressed').should('eq', 'true');
  });

  context('Dots-group navigation (with data)', function () {
    // Link a Table tile with three rows so the dots-group is sized and the
    // trap's visibility filter accepts it as a tab stop. Three distinct dots
    // suffice to verify the useGraphDotsKeyboard contract: arrow keys move
    // focus among them, ArrowRight/ArrowLeft are inverses, and Home/End land
    // on different extremes. The exact reading-order is deliberately not
    // pinned down here — the sort routine is covered at the unit level.
    beforeEach(function () {
      clueCanvas.addTile('table');
      tableToolTile.fillTable(tableToolTile.getTableTile(), [
        [0, 0],
        [1, 1],
        [2, 4],
      ]);
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.linkTable('Table Data 1');
      xyTile.getGraphDot().should('have.length', 3);
    });

    // Identify a dot by its (X, Y) slice of buildDotAriaLabel's output,
    // independent of trailing suffixes like ", Series: ..." or ", Selected".
    const pointFromLabel = label => /X=\d+, Y=\d+/.exec(label || '')?.[0];

    it('Dots-group keyboard contract (tab routing, arrow nav, Home/End, Enter, announcer)', function () {
      selectGraphTile();
      cy.realPress('Tab'); // → X-axis
      cy.realPress('Tab'); // → Y-axis
      cy.realPress('Tab'); // → dots-group surrogate (sized now that data is linked)

      cy.log('Tab from Y-axis routes focus into the dots-group (or its child .graph-dot)');
      cy.focused().then($el => {
        expect($el.closest('[data-graph-dots-group]').length,
          'focused element is inside the dots-group').to.be.greaterThan(0);
      });

      cy.log('Initial focus lands on a child .graph-dot whose aria-label starts with "Point: X=…"');
      cy.focused()
        .should('have.class', 'graph-dot')
        .invoke('attr', 'aria-label')
        .then(initialLabel => {
          expect(initialLabel).to.match(/^Point: X=\d/);
          const initialPoint = pointFromLabel(initialLabel);

          cy.log('ArrowRight moves focus to a different dot, ArrowLeft returns to the original');
          cy.realPress('ArrowRight');
          cy.focused()
            .should('have.class', 'graph-dot')
            .invoke('attr', 'aria-label')
            .then(newLabel => {
              expect(pointFromLabel(newLabel),
                'ArrowRight moved focus to a different dot').to.not.equal(initialPoint);
              cy.realPress('ArrowLeft');
              cy.focused()
                .invoke('attr', 'aria-label')
                .then(returnedLabel => {
                  expect(pointFromLabel(returnedLabel),
                    'ArrowLeft returned to the original dot').to.equal(initialPoint);
                });
            });
        });

      cy.log('Home and End focus distinct dots (the extremes of the reading order)');
      cy.realPress('End');
      cy.focused().invoke('attr', 'aria-label').then(endLabel => {
        const endPoint = pointFromLabel(endLabel);
        cy.realPress('Home');
        cy.focused().invoke('attr', 'aria-label').then(homeLabel => {
          expect(pointFromLabel(homeLabel),
            'Home and End focus different dots').to.not.equal(endPoint);
        });
      });

      cy.log('Enter on a focused dot toggles its selection state (aria toggle-button semantics)');
      cy.focused().invoke('attr', 'aria-label').then(beforeLabel => {
        const wasSelected = /, Selected$/.test(beforeLabel);
        cy.realPress('Enter');
        cy.focused()
          .should('have.class', 'graph-dot')
          .invoke('attr', 'aria-label')
          .then(afterLabel => {
            const isSelected = /, Selected$/.test(afterLabel);
            expect(isSelected, 'Enter toggled selection state').to.equal(!wasSelected);
          });
      });

      cy.log('Aria-live announcer text mirrors the focused dot after Enter');
      // The hook re-reads the dot's aria-label and routes it to the announcer
      // via a double-rAF debounce; Cypress's auto-retry synchronises us with it.
      cy.focused().invoke('attr', 'aria-label').then(dotLabel => {
        xyTile.getTile()
          .find('[data-graph-announcer]')
          .should('have.text', dotLabel);
      });
    });
  });

  context('Read-only mode', function () {
    // The `/editor/` route renders the editable workspace plus
    // `.read-only-local-workspace` (a read-only view of the same content). We
    // exercise the type:"region" path via the read-only workspace.
    beforeEach(function () {
      cy.visit('/editor/?appMode=qa&unit=./demo/units/qa/content.json');
      cy.get('.editable-document-content', { timeout: 60000 });
      clueCanvas.addTile('graph');
    });

    function readOnlyTile() {
      return cy.get('.read-only-local-workspace .graph-tool-tile');
    }

    it('Read-only XY Plot exposes accessible scaffold without editing affordances', function () {
      cy.log('Axis labels are focusable; aria-label omits the "press Enter to edit" suffix');
      readOnlyTile()
        .find('.axis-label.bottom')
        .should('have.attr', 'tabindex', '0')
        .invoke('attr', 'aria-label')
        .should('match', /^X-axis label: /)
        .and('not.match', /press Enter to edit/);
      readOnlyTile()
        .find('.axis-label.left')
        .should('have.attr', 'tabindex', '0')
        .invoke('attr', 'aria-label')
        .and('not.match', /press Enter to edit/);

      cy.log('Enter on a focused read-only axis label does NOT open the inline editor');
      readOnlyTile().find('.axis-label.bottom').focus();
      cy.realPress('Enter');
      readOnlyTile().find('.axis-label.bottom .input-textbox').should('not.exist');

      cy.log('Dots-group surrogate and aria-live announcer are still rendered');
      readOnlyTile()
        .find('[data-graph-dots-group]')
        .should('exist')
        .and('have.attr', 'tabindex', '0')
        .and('have.attr', 'role', 'group');
      readOnlyTile()
        .find('[data-graph-announcer]')
        .should('exist')
        .and('have.attr', 'aria-live', 'polite');
    });
  });

  context('Link-tile dialog focus management', function () {
    // The link-tile button is enabled when any linkable shared model
    // (SharedDataSet, SharedVariables) is registered in the document. A Table
    // tile registers a SharedDataSet on mount, so adding the tile alone —
    // without populating cells — is enough to enable the graph's link button.
    beforeEach(function () {
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
    });

    it('Link-tile dialog: select focused on open, Enter on Cancel does not submit, Escape closes', function () {
      // qa unit's tools array is ['link-tile-multiple', 'fit-all', 'toggle-lock'],
      // so the first toolbar button is link-tile-multiple. Both link-tile and
      // link-tile-multiple call into useProviderTileLinking → showLinkTileDialog
      // and open the same dialog.
      cy.log('Opening with Enter on the link button moves focus straight to the source select');
      xyTile.getTile().click();
      cy.get('button.toolbar-button.link-tile-multiple').focus();
      cy.realPress('Enter');
      xyTile.getCustomModal().should('be.visible');
      cy.focused().should('have.attr', 'data-test', 'link-tile-select');

      cy.log('Choosing a source then pressing Enter on the focused Cancel button closes the dialog');
      cy.get('[data-test=link-tile-select]').select('Table Data 1');
      // The select re-focuses itself on a timer after onChange; flush it before
      // moving focus to Cancel so the timer can't steal focus back to the select.
      cy.wait(100);
      xyTile.getCustomModal().find('.modal-button').contains('Cancel').focus();
      cy.realPress('Enter');
      xyTile.getCustomModal().should('not.exist');

      cy.log('Re-opening shows the source still under "Link Source" — Cancel did not graph it');
      xyTile.getTile().click();
      clueCanvas.clickToolbarButton('graph', 'link-tile-multiple');
      xyTile.getCustomModal().should('be.visible');
      xyTile.getCustomModal().find('optgroup[label="Unlink Source"]').should('not.exist');
      xyTile.getCustomModal().find('optgroup[label="Link Source"]').should('exist');

      cy.log('Escape closes the dialog');
      cy.realPress('Escape');
      xyTile.getCustomModal().should('not.exist');
    });
  });
});
