import ClueCanvas from '../../../support/elements/common/cCanvas';
import XYPlotToolTile from '../../../support/elements/tile/XYPlotToolTile';
import TableToolTile from '../../../support/elements/tile/TableToolTile';

const clueCanvas = new ClueCanvas;
const xyTile = new XYPlotToolTile;
const tableToolTile = new TableToolTile;

context('XY Plot keyboard accessibility (CLUE-502)', function () {
  beforeEach(function () {
    // Use the local qa unit's content.json path rather than the bare `unit=qa`
    // shorthand. The shorthand resolves to a remote qa unit hosted at
    // models-resources.concord.org which is in CODAP-legend mode
    // (defaultSeriesLegend=false) — the local file is CLUE-legend mode
    // (defaultSeriesLegend=true), which is what these tests assume (Enter on
    // an axis label starts an inline edit rather than opening the attribute
    // menu).
    cy.visit('/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5'
      + '&problem=1.1&unit=./demo/units/qa/content.json&noStorage');
    cy.waitForLoad();
    clueCanvas.addTile('graph');
  });

  function selectGraphTile() {
    xyTile.getTile().click();
    cy.realPress('Enter');
    cy.focused().should('have.class', 'editable-tile-title-text');
  }

  // The empty XY-Plot tile in qa unit (CLUE-legend mode) has this trap cycle:
  //   title → X-axis → Y-axis → add-series (legend) → toolbar → resize → wrap.
  // Three things to know:
  //  - The dots-group surrogate is in the DOM with tabIndex=0, but in an empty
  //    graph it's 0×0 (the plot area has no rendered content), so the trap's
  //    visibility filter (`width > 0 && height > 0` for SVG elements) skips it.
  //    Once a dataset is linked, the plot is sized and the dots-group becomes a
  //    real Tab stop.
  //  - The legend (palette slot) always renders an `AddSeriesButton` in CLUE-
  //    legend mode — it's `aria-disabled` until a linkable dataset exists, but
  //    it's still focusable, so the trap visits it as the sole palette stop.
  //  - The toolbar is a single Tab stop with internal arrow-key roving (the
  //    standard pattern via `useRovingTabindex`), so Tab visits the first
  //    toolbar button and the next Tab moves on to the resize handle.
  const emptyFocusOrder = [
    ['class', 'axis-label'],                         // X-axis label (bottom)
    ['class', 'axis-label'],                         // Y-axis label (left)
    ['class', 'add-series-button'],                  // legend's add-series button (palette)
    ['class', 'toolbar-button'],                     // first toolbar button
    ['class', 'tool-tile-resize-handle-wrapper'],    // resize handle
  ];

  function assertFocused([attr, value]) {
    if (attr === 'class') cy.focused().should('have.class', value);
    else if (value === '') cy.focused().should('have.attr', attr);
    else cy.focused().should('have.attr', attr, value);
  }

  it('Tab cycles through every focus slot of an empty XY Plot in expected order', function () {
    selectGraphTile();

    emptyFocusOrder.forEach(entry => {
      cy.realPress('Tab');
      assertFocused(entry);
    });

    // One more Tab wraps to the title.
    cy.realPress('Tab');
    cy.focused().should('have.class', 'editable-tile-title-text');
  });

  it('Shift+Tab cycles in reverse through every focus slot of an empty XY Plot', function () {
    selectGraphTile();

    [...emptyFocusOrder].reverse().forEach(entry => {
      cy.realPress(['Shift', 'Tab']);
      assertFocused(entry);
    });

    // One more Shift+Tab wraps back to the title.
    cy.realPress(['Shift', 'Tab']);
    cy.focused().should('have.class', 'editable-tile-title-text');
  });

  it('Escape exits the trap and returns focus to the .tool-tile container', function () {
    selectGraphTile();
    cy.realPress('Tab'); // Title → X-axis label
    cy.focused().should('have.class', 'axis-label');

    cy.realPress('Escape');
    cy.focused().should('have.class', 'tool-tile');
  });

  context('Axis label editing', function () {
    it('Enter on a focused X-axis label opens the inline editor', function () {
      selectGraphTile();
      cy.realPress('Tab'); // Title → X-axis label
      cy.focused().should('have.class', 'axis-label').and('have.class', 'bottom');
      cy.realPress('Enter'); // enter edit mode
      xyTile.getXAxisLabel().should('have.class', 'editing');
      xyTile.getXAxisInput().should('be.visible');
    });

    it('Typing then Enter commits the new label and returns focus to the trigger', function () {
      selectGraphTile();
      cy.realPress('Tab'); // → X-axis label
      cy.realPress('Enter'); // enter edit mode
      xyTile.getXAxisInput().clear().type('Width');
      cy.realPress('Enter');
      xyTile.getXAxisLabel().should('contain.text', 'Width');
      cy.focused().should('have.class', 'axis-label').and('have.class', 'bottom');
    });

    it('Escape during edit cancels and returns focus to the trigger', function () {
      selectGraphTile();
      cy.realPress('Tab');
      cy.realPress('Enter');
      xyTile.getXAxisInput().type('Throwaway');
      cy.realPress('Escape');
      xyTile.getXAxisLabel().should('not.have.class', 'editing');
      xyTile.getXAxisLabel().should('not.contain.text', 'Throwaway');
      cy.focused().should('have.class', 'axis-label').and('have.class', 'bottom');
    });

    it('Axis label exposes an aria-label that describes the affordance', function () {
      selectGraphTile();
      cy.realPress('Tab');
      cy.focused()
        .should('have.class', 'axis-label')
        .invoke('attr', 'aria-label')
        .should('match', /^X-axis label: .*, press Enter to edit$/);
    });
  });

  context('Dots-group surrogate (empty graph)', function () {
    // In an empty graph (no data linked) the dots-group surrogate's bounding
    // rect is 0×0, so the trap's visibility filter skips it and Tab goes
    // directly from Y-axis to the toolbar. The surrogate IS in the DOM with
    // tabIndex=0, though — that's what these tests pin down. The Tab-from-
    // Y-axis-into-dots-group routing and arrow navigation through real dots
    // is exercised in the "Dots-group navigation (with data)" context below.
    it('Dots-group surrogate is in the DOM with the expected accessibility attributes', function () {
      xyTile.getTile()
        .find('[data-graph-dots-group]')
        .should('exist')
        .and('have.attr', 'tabindex', '0')
        .and('have.attr', 'role', 'group')
        .invoke('attr', 'aria-label')
        .should('contain', 'Data points');
    });

    it('Aria-live announcer is rendered inside the tile', function () {
      // The announcer is unconditional and lives as a direct child of
      // `.graph-wrapper`. The dots-keyboard hook locates it via
      // `closest('.graph-wrapper') > :scope > [data-graph-announcer]`.
      xyTile.getTile()
        .find('[data-graph-announcer]')
        .should('exist')
        .and('have.attr', 'aria-live', 'polite');
    });
  });

  context('Dots-group navigation (with data)', function () {
    // Link a Table tile with three rows so the dots-group is sized and the
    // trap's visibility filter accepts it as a tab stop. Three distinct dots
    // are enough to verify the contract of useGraphDotsKeyboard: arrow keys
    // move focus among them, ArrowRight/ArrowLeft are inverses, and Home/End
    // land on different extremes. The exact reading-order is deliberately not
    // pinned down here — that's verified at the unit level for the sort
    // routine in use-graph-dots-keyboard.
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

    function tabToDotsGroup() {
      // Cycle from title: → X-axis → Y-axis → dots-group surrogate.
      // (With data linked, the dots-group is now sized & visible, so the trap
      // doesn't skip it — Tab from Y-axis lands here rather than on the legend.)
      selectGraphTile();
      cy.realPress('Tab');
      cy.realPress('Tab');
      cy.realPress('Tab');
    }

    // Identify a dot by its (X, Y) coordinate slice of buildDotAriaLabel's output,
    // independent of trailing suffixes like ", Series: ..." or ", Selected".
    const pointFromLabel = label => /X=\d+, Y=\d+/.exec(label || '')?.[0];

    it('Tab from the Y-axis label routes into the dots-group surrogate', function () {
      tabToDotsGroup();
      cy.focused().then($el => {
        const insideDotsGroup = $el.closest('[data-graph-dots-group]').length > 0;
        expect(insideDotsGroup, 'focused element is inside the dots-group').to.be.true;
      });
    });

    it('Initial focus into the dots-group lands on a child .graph-dot', function () {
      tabToDotsGroup();
      cy.focused()
        .should('have.class', 'graph-dot')
        .invoke('attr', 'aria-label')
        .should('match', /^Point: X=\d/);
    });

    it('ArrowRight moves focus to a different dot', function () {
      tabToDotsGroup();
      cy.focused().invoke('attr', 'aria-label').then(initialLabel => {
        const initialPoint = pointFromLabel(initialLabel);
        cy.realPress('ArrowRight');
        cy.focused()
          .should('have.class', 'graph-dot')
          .invoke('attr', 'aria-label')
          .then(newLabel => {
            expect(pointFromLabel(newLabel), 'arrow moved focus to a different dot')
              .to.not.equal(initialPoint);
          });
      });
    });

    it('ArrowRight followed by ArrowLeft returns focus to the original dot', function () {
      tabToDotsGroup();
      cy.focused().invoke('attr', 'aria-label').then(initialLabel => {
        const initialPoint = pointFromLabel(initialLabel);
        cy.realPress('ArrowRight');
        cy.realPress('ArrowLeft');
        cy.focused()
          .invoke('attr', 'aria-label')
          .then(returnedLabel => {
            expect(pointFromLabel(returnedLabel), 'ArrowLeft returned to the original dot')
              .to.equal(initialPoint);
          });
      });
    });

    it('Home and End focus dots at the extremes of the reading order', function () {
      tabToDotsGroup();
      cy.realPress('End');
      cy.focused().invoke('attr', 'aria-label').then(endLabel => {
        const endPoint = pointFromLabel(endLabel);
        cy.realPress('Home');
        cy.focused()
          .invoke('attr', 'aria-label')
          .then(homeLabel => {
            // The beforeEach links 3 rows, so the extremes must be distinct dots.
            expect(pointFromLabel(homeLabel), 'Home and End focus different dots')
              .to.not.equal(endPoint);
          });
      });
    });

    it('Enter on a focused dot leaves it in the selected state', function () {
      // Enter mirrors `handleClickOnDot`: select if unselected, no-op if already
      // selected (Shift+Enter is required to deselect). The click in
      // selectGraphTile() may pre-select the dot at the tile centre, so we can
      // only assert the post-Enter state, not a state change.
      tabToDotsGroup();
      cy.realPress('Enter');
      cy.focused()
        .should('have.class', 'graph-dot')
        .invoke('attr', 'aria-label')
        .should('match', /, Selected$/);
    });

    it('Aria-live announcer text mirrors the focused dot after Enter', function () {
      tabToDotsGroup();
      cy.realPress('Enter');
      // After Enter, the hook re-reads the dot's aria-label and routes it to
      // the announcer via a double-rAF debounce. The two strings should match.
      cy.focused().invoke('attr', 'aria-label').then(dotLabel => {
        xyTile.getTile()
          .find('[data-graph-announcer]')
          .should('have.text', dotLabel);
      });
    });
  });

  context('Toolbar', function () {
    it('Tab past the legend lands on the first toolbar button', function () {
      // Cycle in an empty CLUE-legend graph: title → X-axis → Y-axis →
      // add-series (legend's only palette stop) → first toolbar button.
      selectGraphTile();
      cy.realPress('Tab'); // → X-axis label
      cy.realPress('Tab'); // → Y-axis label
      cy.realPress('Tab'); // → add-series-button (legend / palette slot)
      cy.realPress('Tab'); // → first toolbar button (link-tile-multiple in qa unit)
      cy.focused()
        .should('have.class', 'toolbar-button')
        .and('have.class', 'link-tile-multiple');
    });

    it('Each registered toolbar button exposes an aria-label', function () {
      selectGraphTile();
      // qa unit registers ['link-tile-multiple', 'fit-all', 'toggle-lock'].
      const expected = [
        ['link-tile-multiple', 'Add data'],
        ['fit-all',            'Fit All'],
        ['toggle-lock',        'Lock Axes'],
      ];
      expected.forEach(([name, label]) => {
        cy.get(`button.toolbar-button.${name}`)
          .invoke('attr', 'aria-label')
          .should('eq', label);
      });
    });

    it('Disabled toolbar buttons use aria-disabled (still focusable)', function () {
      selectGraphTile();
      // link-tile-multiple is disabled until a dataset is linkable. In a fresh
      // empty graph it's disabled — verify aria-disabled is used (no HTML disabled).
      cy.get('button.toolbar-button.link-tile-multiple')
        .invoke('attr', 'aria-disabled')
        .should('eq', 'true');
      cy.get('button.toolbar-button.link-tile-multiple')
        .should('not.have.attr', 'disabled');
    });

    it('Enter on a focused fit-all button activates it (no exception thrown)', function () {
      selectGraphTile();
      // The toolbar is a single Tab stop with arrow-key roving (useRovingTabindex).
      // Cycle: X-axis → Y-axis → add-series (palette) → toolbar (first button),
      // then ArrowRight to reach fit-all. In qa unit's tools array
      // ['link-tile-multiple', 'fit-all', 'toggle-lock'], one ArrowRight from
      // link-tile-multiple → fit-all.
      cy.realPress('Tab'); // → X-axis
      cy.realPress('Tab'); // → Y-axis
      cy.realPress('Tab'); // → add-series-button (palette)
      cy.realPress('Tab'); // → toolbar (first button)
      cy.focused().should('have.class', 'link-tile-multiple');
      cy.realPress('ArrowRight'); // → fit-all (roving inside toolbar)
      cy.focused().should('have.class', 'toolbar-button').and('have.class', 'fit-all');
      // fit-all is an immediate-action button. Pressing Enter triggers
      // controller.autoscaleAllAxes() — no observable side effect on an empty
      // graph (no data to scale), but the click should not throw.
      cy.realPress('Enter');
      // Focus remains on the toolbar button after activation.
      cy.focused().should('have.class', 'toolbar-button').and('have.class', 'fit-all');
    });

    it('toggle-lock flips aria-pressed when activated', function () {
      selectGraphTile();
      cy.get('button.toolbar-button.toggle-lock')
        .invoke('attr', 'aria-pressed')
        .should('eq', 'false');
      cy.get('button.toolbar-button.toggle-lock').click();
      cy.get('button.toolbar-button.toggle-lock')
        .invoke('attr', 'aria-pressed')
        .should('eq', 'true');
    });
  });

  context('Read-only mode', function () {
    // The `/editor/` route renders three workspaces side-by-side:
    //  - the primary (editable) workspace,
    //  - `.read-only-local-workspace` — a read-only view of the same content,
    //  - `.read-only-remote-workspace` — a read-only view of a remote copy.
    // We exercise the type:"region" path via `.read-only-local-workspace`.
    beforeEach(function () {
      cy.visit('/editor/?appMode=qa&unit=./demo/units/qa/content.json');
      cy.get('.editable-document-content', { timeout: 60000 });
      clueCanvas.addTile('graph');
    });

    function readOnlyTile() {
      return cy.get('.read-only-local-workspace .graph-tool-tile');
    }

    it('Axis labels are focusable with read-only aria-label (no "press Enter to edit" suffix)', function () {
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
    });

    it('Pressing Enter on a focused read-only axis label does NOT open the editor', function () {
      readOnlyTile()
        .find('.axis-label.bottom')
        .focus();
      cy.realPress('Enter');
      readOnlyTile().find('.axis-label.bottom .input-textbox').should('not.exist');
    });

    it('Dots-group surrogate is present and tab-focusable in read-only mode', function () {
      readOnlyTile()
        .find('[data-graph-dots-group]')
        .should('exist')
        .and('have.attr', 'tabindex', '0')
        .and('have.attr', 'role', 'group');
    });

    it('Aria-live announcer container is rendered in read-only mode', function () {
      readOnlyTile()
        .find('[data-graph-announcer]')
        .should('exist')
        .and('have.attr', 'aria-live', 'polite');
    });
  });

  context('Link-tile dialog focus management', function () {
    // The link-tile button is enabled when ANY linkable shared model
    // (SharedDataSet, SharedVariables) is registered in the document.
    // A Table tile registers a SharedDataSet on mount, so adding the tile
    // alone — without populating any cells — is sufficient to enable the
    // graph's link button (see `useProviderTileLinking.isLinkEnabled`).
    beforeEach(function () {
      clueCanvas.addTile('table');
      tableToolTile.getTableTile().should('be.visible');
    });

    it('Enter on the link-tile button opens the link dialog and moves focus inside', function () {
      // qa unit's tools array is ['link-tile-multiple', 'fit-all', 'toggle-lock'],
      // so the first toolbar button is `link-tile-multiple`. Both link-tile and
      // link-tile-multiple call into `useProviderTileLinking → showLinkTileDialog`
      // and open the same dialog.
      xyTile.getTile().click();
      cy.get('button.toolbar-button.link-tile-multiple').focus();
      cy.realPress('Enter');

      // The dialog mounts as `.custom-modal.link-tile`. Focus should be inside it.
      xyTile.getCustomModal().should('be.visible');
      cy.focused().then($el => {
        expect($el.closest('.custom-modal').length, 'focused element is inside the dialog')
          .to.be.greaterThan(0);
      });
    });

    it('Escape closes the link-tile dialog', function () {
      xyTile.getTile().click();
      cy.get('button.toolbar-button.link-tile-multiple').focus();
      cy.realPress('Enter');
      xyTile.getCustomModal().should('be.visible');

      cy.realPress('Escape');
      xyTile.getCustomModal().should('not.exist');
    });
  });
});
