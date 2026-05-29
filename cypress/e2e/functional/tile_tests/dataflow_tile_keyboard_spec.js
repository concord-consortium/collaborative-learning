import ClueCanvas from '../../../support/elements/common/cCanvas';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';

const clueCanvas = new ClueCanvas;
const dataflowToolTile = new DataflowToolTile;

context('Dataflow keyboard accessibility (CLUE-455)', function () {
  beforeEach(function () {
    cy.visit('/?appMode=qa&fakeClass=5&fakeUser=student:5&qaGroup=5&unit=qa&noStorage');
    cy.waitForLoad();
    clueCanvas.addTile('dataflow');
  });

  function selectDataflowTile() {
    dataflowToolTile.getDataflowTile().click();
    cy.realPress('Enter');
    cy.focused().should('have.class', 'editable-tile-title-text');
  }

  const focusOrder = [
    ['data-testid', 'serial-icon'],
    ['data-testid', 'rate-select'],
    ['data-testid', 'record-data-button'],
    ['data-testid', 'zoom-in-button'],
    ['data-testid', 'zoom-out-button'],
    ['data-testid', 'add-sensor-button'],
    ['class', 'data-set-view'],
    ['class', 'tool-tile-drag-handle-wrapper'],
    ['class', 'tool-tile-resize-handle-wrapper'],
  ];

  function assertFocused([attr, value]) {
    if (attr === 'class') cy.focused().should('have.class', value);
    else cy.focused().should('have.attr', attr, value);
  }

  it('Tab cycles through every focus slot of an empty Dataflow tile in expected order', function () {
    selectDataflowTile();

    focusOrder.forEach((entry) => {
      cy.realPress('Tab');
      assertFocused(entry);
    });

    // One more Tab wraps to the title.
    cy.realPress('Tab');
    cy.focused().should('have.class', 'editable-tile-title-text');
  });

  it('Shift+Tab cycles in reverse through every focus slot of an empty Dataflow tile', function () {
    selectDataflowTile();

    [...focusOrder].reverse().forEach((entry) => {
      cy.realPress(['Shift', 'Tab']);
      assertFocused(entry);
    });

    // One more Shift+Tab wraps back to the title.
    cy.realPress(['Shift', 'Tab']);
    cy.focused().should('have.class', 'editable-tile-title-text');
  });

  it('User can build and connect a 3-node program with the keyboard alone', function () {
    selectDataflowTile();
    dataflowToolTile.getCreateNodeButton('number').focus();

    cy.realPress('Enter'); // Add first block (Number)
    cy.realPress('ArrowDown');
    cy.realPress('ArrowDown');
    cy.realPress('ArrowDown');
    cy.realPress('Enter'); // Add second (Math)
    cy.realPress('ArrowDown');
    cy.realPress('ArrowDown');
    cy.realPress('ArrowDown');
    cy.realPress('ArrowDown');
    cy.realPress('Enter'); // Add third (Demo Output)

    dataflowToolTile.getDataflowTile().find('.editor-graph-container .node')
      .should('have.length', 3);

    // Connect Number → Math
    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .output').focus();
    cy.focused().should('have.attr', 'data-socket-side', 'output');

    cy.realPress('Enter'); // begin connecting mode
    cy.focused().should('have.attr', 'data-socket-side', 'input');

    cy.realPress('Enter'); // commit on first candidate (Math.num1 by reading order)
    dataflowToolTile.getDataflowTile().find('.dataflow-connection')
      .should('have.length', 1);

    // Connect Math → Demo Output
    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.math .output').focus();
    cy.focused().should('have.attr', 'data-socket-side', 'output');

    cy.realPress('Enter');
    cy.focused().should('have.attr', 'data-socket-side', 'input');

    cy.realPress('Enter'); // commit (Demo Output.nodeValue is the only candidate)
    dataflowToolTile.getDataflowTile().find('.dataflow-connection')
      .should('have.length', 2);
  });

  it('Escape during connecting mode cancels and restores focus to the source socket', function () {
    selectDataflowTile();
    dataflowToolTile.getCreateNodeButton('number').click();
    dataflowToolTile.getCreateNodeButton('demo-output').click();

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .output').focus();
    cy.realPress('Enter'); // begin connecting mode
    cy.focused().should('have.attr', 'data-socket-side', 'input');

    cy.realPress('Escape');
    cy.focused().should('have.attr', 'data-socket-side', 'output');
    cy.focused().should('have.attr', 'data-node-id');

    // No connection was committed.
    dataflowToolTile.getDataflowTile().find('.dataflow-connection').should('not.exist');
  });

  it('Tab moves focus from one block to the next, skipping internal controls', function () {
    selectDataflowTile();
    dataflowToolTile.getCreateNodeButton('number').click();
    dataflowToolTile.getCreateNodeButton('math').click();
    dataflowToolTile.getCreateNodeButton('demo-output').click();

    // Land focus on the first block container.
    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number').focus();
    cy.focused().invoke('attr', 'aria-label').should('match', /^Number block:/);

    cy.realPress('Tab');
    cy.focused().invoke('attr', 'aria-label').should('match', /^Math block:/);

    cy.realPress('Tab');
    cy.focused().invoke('attr', 'aria-label').should('match', /^Demo Output block:/);

    cy.realPress(['Shift', 'Tab']);
    cy.focused().invoke('attr', 'aria-label').should('match', /^Math block:/);
  });

  it('Arrow keys cycle through a block\'s interactive elements within the focused block', function () {
    selectDataflowTile();
    dataflowToolTile.getCreateNodeButton('number').click();

    // The Number block's interactive descendants in DOM order are:
    //   close-node-button, node-name-input, output socket (value),
    //   number-input (value control), graph-button (plot toggle).
    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number').focus();

    // ArrowDown on the block container enters the cycle on the first interactive.
    cy.realPress('ArrowDown');
    cy.focused().should('have.class', 'close-node-button');

    cy.realPress('ArrowDown');
    cy.focused().should('have.class', 'node-name-input');

    // Skip the rove-out-of-text-input behavior on this stop with ArrowDown
    // (ArrowLeft/Right would move the caret instead).
    cy.realPress('ArrowDown');
    cy.focused().should('have.attr', 'data-socket-side', 'output');

    cy.realPress('ArrowDown');
    cy.focused().should('have.class', 'number-input');

    cy.realPress('ArrowDown');
    cy.focused().should('have.class', 'graph-button');

    // Wraps back to the first interactive — focus stays inside this Number block.
    cy.realPress('ArrowDown');
    cy.focused().should('have.class', 'close-node-button');

    // ArrowUp at the first interactive wraps to the last interactive (still inside the same block).
    cy.realPress('ArrowUp');
    cy.focused().should('have.class', 'graph-button');
  });

  it('Arrow keys inside a text input move the caret instead of cycling out', function () {
    selectDataflowTile();
    dataflowToolTile.getCreateNodeButton('number').click();

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .node-name-input')
      .focus()
      .invoke('val', 'Hello')
      .then($input => $input.get(0).setSelectionRange(5, 5));

    // ArrowLeft inside a text input is left to native handling so the caret moves.
    cy.realPress('ArrowLeft');
    cy.focused().should('have.class', 'node-name-input');
    cy.focused().then($input => {
      expect($input.get(0).selectionStart).to.equal(4);
    });
  });

  it('Enter on a focused node toggles its selected state', function () {
    dataflowToolTile.getCreateNodeButton('number').click();

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number')
      .focus()
      .should('not.have.class', 'selected');

    cy.realPress('Enter');
    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number')
      .should('have.class', 'selected');
  });

  it('Arrow keys cycle through candidate inputs during connecting mode', function () {
    selectDataflowTile();
    dataflowToolTile.getCreateNodeButton('number').click();
    dataflowToolTile.getCreateNodeButton('math').click();
    dataflowToolTile.getCreateNodeButton('demo-output').click();

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .output').focus();
    cy.realPress('Enter'); // begin connecting mode

    // Candidates are sorted by reading order, then by input declaration order
    // within a node: Math.num1, Math.num2, DemoOutput.nodeValue.
    cy.focused().should('have.attr', 'data-socket-key', 'num1');

    cy.realPress('ArrowDown');
    cy.focused().should('have.attr', 'data-socket-key', 'num2');

    cy.realPress('ArrowDown');
    cy.focused().should('have.attr', 'data-socket-key', 'nodeValue');

    cy.realPress('ArrowDown'); // wraps back to first candidate
    cy.focused().should('have.attr', 'data-socket-key', 'num1');

    cy.realPress('ArrowUp'); // wraps backward
    cy.focused().should('have.attr', 'data-socket-key', 'nodeValue');
  });

  it('Delete button on a node removes the node when activated by keyboard', function () {
    dataflowToolTile.getCreateNodeButton('number').click();
    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node').should('have.length', 1);

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .close-node-button').focus();
    cy.realPress('Enter');

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node').should('not.exist');
  });

  it('Block name is editable from the keyboard', function () {
    dataflowToolTile.getCreateNodeButton('number').click();

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .node-name-input')
      .focus()
      .clear()
      .type('My Custom Number');
    cy.realPress('Enter'); // blurs the input, persisting the new name

    dataflowToolTile.getDataflowTile()
      .find('.editor-graph-container .node.number .node-name-input')
      .should('have.value', 'My Custom Number');
  });

  context('Live-region announcements', function () {
    beforeEach(function () {
      selectDataflowTile();
    });

    function announcer() {
      return dataflowToolTile.getDataflowTile()
        .find('[data-testid="dataflow-announcer"]');
    }

    it('announces "Selected …" when Enter selects a focused block', function () {
      dataflowToolTile.getCreateNodeButton('number').click();
      dataflowToolTile.getDataflowTile()
        .find('.editor-graph-container .node.number').focus();
      cy.realPress('Enter');

      announcer().should('contain.text', 'Selected Number block Number 1');
    });

    it('announces "Connecting from …" when Enter starts a connection', function () {
      dataflowToolTile.getCreateNodeButton('number').click();
      dataflowToolTile.getCreateNodeButton('demo-output').click();

      dataflowToolTile.getDataflowTile()
        .find('.editor-graph-container .node.number .output').focus();
      cy.realPress('Enter');

      announcer()
        .should('contain.text', 'Connecting from')
        .and('contain.text', 'Use arrow keys');
    });

    it('announces "No compatible target sockets" when nothing accepts the source', function () {
      // Only a Number block exists, so no input sockets are reachable.
      dataflowToolTile.getCreateNodeButton('number').click();

      dataflowToolTile.getDataflowTile()
        .find('.editor-graph-container .node.number .output').focus();
      cy.realPress('Enter');

      announcer().should('contain.text', 'No compatible target sockets');
    });

    it('announces "Connected …" when a connection is committed', function () {
      dataflowToolTile.getCreateNodeButton('number').click();
      dataflowToolTile.getCreateNodeButton('demo-output').click();

      dataflowToolTile.getDataflowTile()
        .find('.editor-graph-container .node.number .output').focus();
      cy.realPress('Enter'); // begin connecting mode
      cy.realPress('Enter'); // commit on first candidate

      announcer().should('contain.text', 'Connected Number to Demo Output');
    });

    it('announces "Cancelled connection" when Escape exits connecting mode', function () {
      dataflowToolTile.getCreateNodeButton('number').click();
      dataflowToolTile.getCreateNodeButton('demo-output').click();

      dataflowToolTile.getDataflowTile()
        .find('.editor-graph-container .node.number .output').focus();
      cy.realPress('Enter'); // begin connecting mode
      cy.realPress('Escape');

      announcer().should('contain.text', 'Cancelled connection');
    });
  });
});
