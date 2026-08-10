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

// The demo document ships an authored variable chip, so this spec never has to drive the
// Insert Variable dialog — the starting state is deterministic.
const documentUrl = "/editor/?appMode=qa&unit=./demo/units/qa/content.json" +
  "&document=./demo/docs/emg-highlight-demo.json";

context("Highlight references", () => {
  beforeEach(() => {
    cy.visit(documentUrl);
    cy.get(SENSOR_NODE).should("exist");   // the document has finished loading
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
    // The /editor/ route renders the document more than once, so scope the interaction to one
    // editor. The assertions below still check every rendering: all of them read the same
    // content model, so deleting the chip must clear it from all of them.
    cy.get(TEXT_EDITOR).first().as("editor");
    cy.get("@editor").find(VARIABLE_CHIP).first().as("chip");

    cy.get("@chip").click();
    cy.get(SENSOR_NODE).first().should("have.class", "highlight-pinned");

    // Focus the way TextToolTile.enterText does (TextToolTile.js:15-24): focus the tile, then
    // click the editor, with a wait because the editor is briefly inaccessible after render.
    // Clicking the chip alone will not focus anything — it is contentEditable={false}.
    cy.wait(500);
    cy.get(TEXT_TILE).first().focus();
    cy.get("@editor").click("left");

    // Select the whole paragraph and delete, rather than walking the caret to the chip. An
    // earlier version pressed End then Backspace, which passed locally and failed in CI: End
    // goes to the end of the *visual* line, and CI's viewport wraps this paragraph differently,
    // so Backspace ate a character of the prose instead of the chip. Selecting everything is
    // independent of both wrapping and caret position.
    cy.realPress([Cypress.platform === "darwin" ? "Meta" : "Control", "a"]);
    cy.realPress("Backspace");

    cy.get(VARIABLE_CHIP).should("not.exist");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-pinned");
    cy.get(SENSOR_NODE).should("not.have.class", "highlight-preview");
  });
});
