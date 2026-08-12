// NOTE: this spec deliberately does NOT use DataflowToolTile.getNode(). That helper builds the
// selector `.primary-workspace .node.<type>` (see getNodeText at DataflowToolTile.js:1), and
// `.primary-workspace` is a CLUE workspace class that does not exist on the standalone /editor/
// route this spec loads. The node class itself is what we assert on, so select it directly.
//
// The node's type class comes from `model.type.toLowerCase().replace(/ /g, "-")` in
// dataflow-node.tsx, so "Sensor" -> .sensor and "Live Output" -> .live-output.
const SENSOR_NODE = ".node.sensor";

// Similarly, TextToolTile's helpers default to `.primary-workspace .canvas-area ...` selectors.
// `.primary-workspace` doesn't exist on /editor/, but `.canvas-area` does (it's rendered by
// EditableDocumentContent regardless of route), so we select tiles under it directly.
const TEXT_EDITOR = ".canvas-area .text-tool-editor";
const TEXT_TILE = ".canvas-area .text-tool";
const VARIABLE_CHIP = ".slate-variable-chip";

// The sketch tile draws its emphasis as an SVG rect rather than with a class on the object, so
// these select the ring itself. data-object-id names which object the ring belongs to, which is
// what lets the spec assert that the right chip lit up rather than merely that something did.
// (`.slate-variable-chip` is slate-only, so it never matches the sketch's own variable chips.)
const SKETCH_TILE = ".canvas-area .drawing-tool";
const HIGHLIGHT_BOX = "[data-testid=highlight-reference-box]";
const EMG_SKETCH_BOX = `${HIGHLIGHT_BOX}[data-object-id=emgSketchChip]`;
const GRIPPER_SKETCH_BOX = `${HIGHLIGHT_BOX}[data-object-id=gripperSketchChip]`;

// The demo document ships an authored variable chip, so this spec never has to drive the
// Insert Variable dialog — the starting state is deterministic.
// noStorage=true is load-bearing, not tidiness. Without it the doc-editor restores a document
// from sessionStorage and creates a model from it (doc-editor-app.tsx:32-42), then REPLACES that
// model once the `document=` param finishes loading. Tile types that register lazily — Drawing is
// one — can end up bound to the superseded instance while the eagerly-present tiles move to the
// new one, leaving two document-content instances in a single pane. Cross-tile ephemeral state
// (highlight refs are volatile, per-document) then cannot travel between them: hovering the text
// chip highlights the Dataflow node and does nothing to the sketch.
//
// Cypress starts with clean session storage, so this passes either way — which is exactly the
// problem. A developer running the same URL in a browser they have been using all day hits the
// stale document and sees the feature do nothing. Pin it here so the spec depends on a stated
// condition rather than an accident of the runner.
const documentUrl = "/editor/?appMode=qa&unit=./demo/units/qa/content.json" +
  "&noStorage=true&document=./demo/docs/emg-highlight-demo.json";

// The doc-editor renders the document in up to three panes: the editable one plus a Read Only
// Local and a Read Only Remote (emulated) copy, gated by these settings (doc-editor-settings.ts,
// consumed at doc-editor-app.tsx:290-298). Both default to true.
//
// Turn them off. They are not merely redundant renderings — the remote copy is REBUILT from a
// snapshot on every document change (`setRemoteDocument(createDocumentModelWithEnv(...))`,
// doc-editor-app.tsx:80), and this fixture runs a Simulator that writes variable values
// continuously, so that pane mints a fresh document-content instance over and over. Tiles in
// different copies are therefore in different MST trees with their own volatile state, and a
// highlight set from a chip in one copy can never reach a tile in another.
//
// Left on, this spec passed while the feature did nothing in the pane a human was watching:
// unscoped selectors are satisfied by a ring in any copy. One pane makes every assertion here
// unambiguous.
const kDocEditorSettings = JSON.stringify({
  showLocalReadOnly: false, showRemoteReadOnly: false, minimalAISummary: false
});

context("Highlight references", () => {
  beforeEach(() => {
    cy.visit(documentUrl, {
      onBeforeLoad(win) {
        win.localStorage.setItem("clue-doc-editor-settings", kDocEditorSettings);
      }
    });
    cy.get(SENSOR_NODE).should("exist");   // the document has finished loading
    // One copy only, so any later count of 1 is meaningful rather than an artifact of `.first()`.
    cy.get(TEXT_EDITOR).should("have.length", 1);
  });

  it("previews highlighted Dataflow nodes on chip hover and pins them on click", () => {
    cy.get(VARIABLE_CHIP).first().as("chip");

    // Nothing highlighted to start.
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-preview");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-pinned");

    // Hover previews.
    // trigger("mouseover"/"mouseout"), not "mouseenter"/"mouseleave": React implements the
    // onMouseEnter/onMouseLeave props via native "mouseover"/"mouseout" listeners at the root
    // (see registerDirectEvent('onMouseEnter', ['mouseout', 'mouseover']) in react-dom), so
    // dispatching a raw "mouseenter"/"mouseleave" DOM event never reaches React's handlers.
    cy.get("@chip").trigger("mouseover");
    cy.get(SENSOR_NODE).should("have.class", "highlight-preview");

    // Mouse-out clears the preview.
    cy.get("@chip").trigger("mouseout");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-preview");

    // Click pins, and it survives moving the mouse away.
    cy.get("@chip").click();
    cy.get("@chip").trigger("mouseout");
    cy.get(SENSOR_NODE).should("have.class", "highlight-pinned");

    // Clicking again unpins.
    cy.get("@chip").click();
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-pinned");
  });

  // The chip renders its own highlight rather than borrowing the selection style, so the two can
  // be told apart. Without this the chip has no highlight indicator at all: a highlight it owns is
  // invisible on the chip itself, and the Dataflow ring looks orphaned.
  it("shows the highlight on the chip itself, in the same states as its targets", () => {
    cy.get(VARIABLE_CHIP).first().as("chip");

    cy.get("@chip").should("not.have.class", "highlight-preview");
    cy.get("@chip").should("not.have.class", "highlight-pinned");

    cy.get("@chip").trigger("mouseover");
    cy.get("@chip").should("have.class", "highlight-preview");
    cy.get(SENSOR_NODE).should("have.class", "highlight-preview");

    cy.get("@chip").trigger("mouseout");
    cy.get("@chip").should("not.have.class", "highlight-preview");

    cy.get("@chip").click();
    cy.get("@chip").should("have.class", "highlight-pinned");
    cy.get(SENSOR_NODE).should("have.class", "highlight-pinned");
  });

  // Regression for the review of this PR: with the chip's highlight borrowed from Slate selection,
  // clicking elsewhere in the text dropped the chip's indicator while the Dataflow node stayed lit,
  // so the two disagreed and the ring looked stranded. The highlight is deliberately NOT selection
  // — it has to outlive the caret moving away — so the correct behavior is that both stay lit.
  it("keeps the chip and its targets in agreement when the selection moves away", () => {
    cy.get(TEXT_EDITOR).first().as("editor");
    cy.get("@editor").find(VARIABLE_CHIP).first().as("chip");

    cy.get("@chip").click();
    cy.get("@chip").should("have.class", "highlight-pinned");
    cy.get(SENSOR_NODE).first().should("have.class", "highlight-pinned");

    // Move the Slate selection off the chip without touching the highlight. realClick, not click:
    // a forced synthetic click gets past the tile's drag-handle overlay but never places a caret,
    // so the selection would not actually move and the assertion below would pass vacuously.
    cy.get("@editor").find("p").first().realClick({ position: "left" });

    // `slate-selected` is applied to the inner VariableChip, not to `.slate-variable-chip`, so
    // this has to look inside the chip — asserting not.have.class on the outer span would pass
    // whether or not the selection ever moved.
    cy.get("@chip").find(".slate-selected").should("not.exist");
    cy.get("@chip").should("have.class", "highlight-pinned");
    cy.get(SENSOR_NODE).first().should("have.class", "highlight-pinned");
  });

  // The sketch tile is a highlight target reached by the SAME variable reference that drives the
  // Dataflow nodes — its variable chips store a variableId, so the existing text chip lights them
  // with no new source and no changes to the highlight machinery.
  //
  // The fixture's second sketch chip (Gripper) is load-bearing: the point of the feature is to
  // direct attention to one specific thing, so a reference that lit every variable chip would be
  // a failure rather than an enhancement. Asserting it stays dark is what proves that.
  it("previews the sketch chip bound to the same variable, and only that chip", () => {
    cy.get(SKETCH_TILE).should("exist");
    cy.get(TEXT_EDITOR).first().find(VARIABLE_CHIP).first().as("chip");

    cy.get(HIGHLIGHT_BOX).should("not.exist");

    // mouseover/mouseout rather than mouseenter/mouseleave, for the React reason documented above.
    cy.get("@chip").trigger("mouseover");
    cy.get(EMG_SKETCH_BOX).should("have.class", "preview");
    // Assert the computed stroke, not just the class. The ring's color comes from CSS while its
    // geometry is inline, so a class assertion alone would pass with the rule not reaching the
    // rect at all — leaving a ring that is in the DOM and invisible. $highlight-preview-ring.
    cy.get(EMG_SKETCH_BOX).should("have.css", "stroke", "rgb(120, 140, 255)");
    cy.get(GRIPPER_SKETCH_BOX).should("not.exist");

    cy.get("@chip").trigger("mouseout");
    cy.get(HIGHLIGHT_BOX).should("not.exist");

    // Click pins, and it survives moving the mouse away.
    cy.get("@chip").click();
    cy.get("@chip").trigger("mouseout");
    cy.get(EMG_SKETCH_BOX).should("have.class", "pinned");
    cy.get(GRIPPER_SKETCH_BOX).should("not.exist");

    // Clicking again unpins.
    cy.get("@chip").click();
    cy.get(HIGHLIGHT_BOX).should("not.exist");
  });

  // Guards against a regression from wiring hover/click handlers onto the chip (a Slate inline
  // void element) inside the text tile's contentEditable: those handlers must not interfere
  // with normal Slate typing/selection behavior around the chip.
  it("still allows normal text editing in a tile that contains a variable chip", () => {
    cy.get(VARIABLE_CHIP).should("exist");

    // cy.realType/cy.realPress (from cypress-real-events), not cy.type(): slate-react listens
    // for native `beforeinput` events via addEventListener, not React synthetic props, and
    // cy.type() never dispatches those, so typed characters would silently never reach the
    // editor. This mirrors TextToolTile.js's _dispatchKeystrokes, which documents the same
    // constraint for every other text-tile Cypress helper in this suite.
    //
    // { force: true }: verified cause, not a workaround for a stale build error. Clicking at
    // "right" targets a point in the top-right corner of the editor's bounding box that is
    // genuinely covered by the tile's `.tool-tile-drag-handle` SVG icon, which CLUE renders
    // absolutely-positioned over that corner of every tile. force:true bypasses Cypress's
    // actionability/covering check for this one click; it does not affect what's asserted below.
    cy.get(TEXT_EDITOR).click("right", { force: true });
    cy.realPress("End");
    cy.realType(" Typed after the chip.");

    cy.get(TEXT_EDITOR).should("contain", "Typed after the chip.");
    // The chip itself must survive the edit — typing should not have deleted or corrupted it.
    cy.get(VARIABLE_CHIP).should("exist");
  });

  // Regression: deleting a chip must release the highlight it owns. Clicking the chip is the
  // only way to unpin, so a pin that outlives its chip can never be dismissed and would stay on
  // screen for the rest of the session. React also does not fire onMouseLeave for an element
  // that unmounts under the cursor, so the preview has the same problem.
  //
  // This needs a real Slate unmount, which is why it lives here rather than in a unit test.
  it("releases a pinned highlight when its chip is deleted", () => {
    cy.get(TEXT_EDITOR).first().as("editor");
    cy.get("@editor").find(VARIABLE_CHIP).first().as("chip");

    cy.get("@chip").click();
    cy.get(SENSOR_NODE).first().should("have.class", "highlight-pinned");

    // Focus the way TextToolTile.enterText does (TextToolTile.js:15-24): focus the tile, then
    // click the editor, with a wait because the editor is briefly inaccessible after render.
    // Clicking the chip alone will not focus anything — it is contentEditable={false}.
    cy.wait(500);
    cy.get(TEXT_TILE).first().focus();

    // Triple-click the paragraph to select it, then delete. Two rejected alternatives, both of
    // which produced green-looking runs that proved nothing:
    //
    // - End then Backspace walks the caret to the chip, but End goes to the end of the *visual*
    //   line, so it passed locally and ate a character of prose under CI's narrower viewport.
    // - Cmd+A is ambiguous about scope. Depending on whether focus settled on the tile or inside
    //   Slate it either selects nothing (the chip survives and the test fails) or selects every
    //   tile in the document (the Dataflow tile is deleted too, so the assertions below cannot
    //   run at all).
    //
    // A triple-click selects exactly this paragraph, independent of wrapping and of which
    // element ended up focused. force:true gets past CLUE's absolutely-positioned
    // `.tool-tile-drag-handle`, which overlays the tile's corner.
    cy.get("@editor").find("p").first().click({ clickCount: 3, force: true });
    cy.realPress("Backspace");

    cy.get(VARIABLE_CHIP).should("not.exist");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-pinned");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-preview");
  });
});
