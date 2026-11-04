import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const dataflowToolTile = new DataflowToolTile;

function visitUnit(studentId) {
  const queryParams = `${Cypress.config("qaUnitStudent5")}`.replace("student:5", `student:${studentId}`);
  cy.visit(queryParams, {
    onBeforeLoad(win) {
      win.localStorage.setItem("debug", "document");
    }
  });
  cy.waitForLoad();
  cy.window().its("currentDocument").should("exist");
}

// Returns the RTDB node that holds the current document's content and its save envelope.
function getEnvelopeRef(win) {
  const { firebase } = win.stores.db;
  return firebase.ref(firebase.getDocumentPaths(win.stores.user, win.currentDocument).content);
}

function readEnvelope() {
  return cy.window().then(win => getEnvelopeRef(win).once("value")).then(snapshot => snapshot.val());
}

// Polls the envelope until `predicate` holds, with a bounded number of retries.
function waitForEnvelope(predicate, description, attemptsLeft = 20) {
  return readEnvelope().then(envelope => {
    if (predicate(envelope)) return cy.wrap(envelope);
    expect(attemptsLeft, `envelope ${description}: ${JSON.stringify({ ...envelope, content: undefined })}`)
      .to.be.greaterThan(0);
    cy.wait(500);
    return waitForEnvelope(predicate, description, attemptsLeft - 1);
  });
}

context("Settled saves", function () {
  it("saves an individual document exactly and catches it up on reload", function () {
    visitUnit(5);

    cy.log("a burst of edits ends in an exact save");
    clueCanvas.addTile("text");
    textToolTile.verifyTextTileIsEditable();
    textToolTile.enterText("first burst of edits");
    cy.waitForSave();
    waitForEnvelope(e => e.settled === true, "is settled").then(e1 => {
      expect(e1.lastHistoryEntryId).to.be.a("string");
      expect(e1.lastHistoryEntryIndex).to.be.a("number");
      expect(e1.exactSince).to.be.a("string");
      expect(e1.unsettled).to.equal(undefined);

      cy.log("one more edit is saved");
      const lastEdit = " and one last edit";
      textToolTile.enterAdditionalText(lastEdit);
      cy.waitForSave();
      waitForEnvelope(e => e.lastHistoryEntryIndex > e1.lastHistoryEntryIndex, "holds the last edit")
        .then(e2 => {
          cy.log("put the older envelope back so the document is behind its history");
          cy.window().then(win => getEnvelopeRef(win).set(e1));

          cy.reload();
          cy.waitForLoad();

          cy.log("the load applies the history entries after the envelope");
          textToolTile.getTextTile().last().should("contain", lastEdit);

          cy.log("the next save is exact");
          textToolTile.enterAdditionalText(" after the reload");
          cy.waitForSave();
          waitForEnvelope(
            e => e.settled === true && e.lastHistoryEntryIndex > e2.lastHistoryEntryIndex,
            "is settled past the last edit"
          );
        });
    });
  });

  it("keeps saving exactly while a DataFlow program runs", function () {
    visitUnit(6);

    cy.log("a program with a generator ticks");
    clueCanvas.addTile("dataflow");
    dataflowToolTile.getDataflowTile().should("exist");
    dataflowToolTile.getCreateNodeButton("generator").click();
    dataflowToolTile.getNode("generator").should("exist");

    waitForEnvelope(e => e.settled === true, "is settled").then(first => {
      cy.wait(3000);
      waitForEnvelope(
        e => e.settled === true && e.lastHistoryEntryId !== first.lastHistoryEntryId,
        "is settled at a later entry"
      ).then(second => {
        expect(second.lastHistoryEntryIndex).to.be.greaterThan(first.lastHistoryEntryIndex);
      });
    });
  });
});
