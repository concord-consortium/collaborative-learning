import ClueCanvas from '../../../support/elements/common/cCanvas';
import TextToolTile from '../../../support/elements/tile/TextToolTile';
import DataflowToolTile from '../../../support/elements/tile/DataflowToolTile';
import SortedWork from '../../../support/elements/common/SortedWork';

const clueCanvas = new ClueCanvas;
const textToolTile = new TextToolTile;
const dataflowToolTile = new DataflowToolTile;
const sortWork = new SortedWork;

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

// Whether the envelope's exactThrough describes its id: the content is exactly the history.
const isExact = envelope => !!envelope?.exactThrough && envelope.exactThrough.id === envelope.lastHistoryEntryId;
const exactIndex = envelope => envelope.exactThrough.index;

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

const saveIndicator = '[data-testid="save-indicator"]';

// Saving can show for less time than a check takes, so the indicator's container is watched for
// it from now on. The returned record says whether it has shown.
function watchForSaving() {
  return cy.get(saveIndicator).first().then($indicator => {
    const container = $indicator[0].parentElement;
    const record = { sawSaving: false };
    const check = () => {
      if (container.querySelector(saveIndicator)?.textContent.includes("Saving")) record.sawSaving = true;
    };
    new MutationObserver(check).observe(container, { childList: true, subtree: true, characterData: true });
    check();
    return record;
  });
}

// Saves of background changes leave the indicator alone: it shows the last user change's Saved
// until that goes back to no text a few seconds later, and never shows Saving.
function expectNoSavingShown(record) {
  cy.get(saveIndicator).should($indicators => {
    $indicators.each((_index, indicator) => {
      expect(["", "Saved"]).to.include(Cypress.$(indicator).find(".save-indicator-text").text());
    });
  }).then(() => {
    expect(record.sawSaving, "the indicator showed Saving").to.equal(false);
  });
}

context("Settled saves", function () {
  it("saves an individual document exactly, opens its history at the newest entry, and catches it up on reload",
      function () {
    visitUnit(5);

    cy.log("a burst of edits ends in an exact save");
    clueCanvas.addTile("text");
    textToolTile.verifyTextTileIsEditable();
    textToolTile.enterText("first burst of edits");
    cy.waitForSave();
    waitForEnvelope(isExact, "is exact").then(e1 => {
      expect(e1.lastHistoryEntryId).to.be.a("string");
      expect(e1.exactThrough.index).to.be.a("number");
      expect(e1.exactThrough.contentHash).to.be.a("number");
      expect(e1.exactThrough.since).to.be.a("string");
      expect(e1.notExact).to.equal(undefined);

      cy.log("one more edit is saved");
      const lastEdit = " and one last edit";
      textToolTile.enterAdditionalText(lastEdit);
      cy.waitForSave();
      waitForEnvelope(e => isExact(e) && exactIndex(e) > exactIndex(e1), "holds the last edit")
        .then(e2 => {
          cy.log("put the older envelope back so the document is behind its history");
          cy.window().then(win => getEnvelopeRef(win).set(e1));

          cy.log("a teacher's history of the document opens at the last edit");
          cy.visit(Cypress.config("qaUnitTeacher6"));
          cy.waitForLoad();
          cy.openTopTab("sort-work");
          cy.get(".section-header-arrow").click({ multiple: true });
          sortWork.getSortWorkItem().contains("Student 5").click();
          const teacherTextTile = () => cy.get(".resource-and-chat-panel .text-tool");
          teacherTextTile().should("contain", "first burst of edits").and("not.contain", lastEdit);
          cy.get(".resource-and-chat-panel .toolbar .tool.toggleplayback:visible").click();
          cy.get('[data-testid="playback-slider"]').should("be.visible");
          teacherTextTile().should("contain", lastEdit);
          cy.get('[data-testid="playback-play-button"]').should("have.class", "disabled");

          visitUnit(5);

          cy.log("the load applies the history entries after the envelope");
          textToolTile.getTextTile().last().should("contain", lastEdit);

          cy.log("the next save is exact");
          // The tile mounts once the catch-up finishes, and a text editor that was just mounted
          // drops keystrokes for a moment (see TextToolTile.enterText).
          textToolTile.verifyTextTileIsEditable();
          cy.wait(500);
          textToolTile.enterAdditionalText(" after the reload");
          cy.waitForSave();
          waitForEnvelope(
            e => isExact(e) && exactIndex(e) > exactIndex(e2),
            "is exact past the last edit"
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
    cy.waitForSave();
    watchForSaving().then(record => {
      // The baseline is taken once the node exists, so adding it can't account for the later
      // entries. The program ticks once a second, and each tick is an entry.
      waitForEnvelope(isExact, "is exact").then(first => {
        cy.log("the ticks are saved without showing the saving indicator");
        cy.wait(1500);
        expectNoSavingShown(record);
        cy.wait(1500);
        expectNoSavingShown(record);
        waitForEnvelope(
          e => isExact(e) && exactIndex(e) >= exactIndex(first) + 3,
          "is exact at least three entries later"
        );
      });
    });
  });
});
