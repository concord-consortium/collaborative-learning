import { portalLaunchConfig } from "../../support/portal-launch";
import ClueCanvas from "../../support/elements/common/cCanvas";
import TextToolTile from "../../support/elements/tile/TextToolTile";
import TeacherDashboard from "../../support/elements/common/TeacherDashboard";

const clueCanvas = new ClueCanvas();
const textToolTile = new TextToolTile();
const dashboard = new TeacherDashboard();

// Checks that a build works through a real portal launch: the student's work saves to Firebase
// under the portal's rules, survives a fresh launch, and reaches the teacher.
//
// The users and assignment are shared between runs. Each run adds its own text tile, holding a
// timestamped marker, and works only with that tile by id. Runs can't safely overlap, though:
// they edit the same document, and each session saves the whole document. So a run stops at once
// if it finds a recent marker from another run, and deletes older ones, which are left behind by
// runs that failed before their cleanup.
const config = portalLaunchConfig();

const kMarkerPrefix = "Portal launch check ";
// "Portal launch check <run start> attempt <n>". The run start is set when the spec file loads,
// so every retry of the test shares it: a retry's own earlier attempts are leftovers to delete,
// not another run.
const kMarkerPattern = /Portal launch check (\d{4}-\d\d-\d\dT[\d:.]+Z)/;
const kRunStart = new Date().toISOString();
/** A marker younger than this is taken to belong to a run that's still going. */
const kRunInProgressMinutes = 15;
const kCanvas = ".primary-workspace .canvas-area";

function launch(portalLaunchUrl) {
  return cy.launchFromPortal(portalLaunchUrl, { keepClueUrl: config.keepClueUrl });
}

function checkVersion() {
  if (config.expectedVersion) {
    cy.get(".version").should("have.text", `CLUE v${config.expectedVersion}`);
  }
}

// The teacher dashboard shows each student's problem document, but a launch reopens whichever
// document the student last had open, which can be a personal one. Open the current offering's
// problem document through File > Open..., which every unit has even when its My Work tab is
// hidden. The list does not say which document is the problem one, so ask CLUE for the one it
// loaded for this offering.
function openProblemDocument() {
  cy.window().its("stores.documents.requiredDocuments.problem.promise").then(promise => {
    cy.wrap(promise).then(problemDoc => {
      expect(problemDoc, "the student's problem document for this offering").to.exist;
      cy.get("[data-test=document-file-menu-header]").click();
      cy.get("[data-test=list-item-icon-open-workspace]").click();
      cy.get(`.primary-workspace .list-item[data-document-key="${problemDoc.key}"]`).click();
      cy.window().its("stores.persistentUI.problemWorkspace.primaryDocumentKey").should("eq", problemDoc.key);
    });
  });
}

function tileSelector(tileId) {
  return `${kCanvas} [data-tool-id="${tileId}"]`;
}

function deleteTile(tileId) {
  cy.get(`${tileSelector(tileId)} .text-tool-wrapper`).click({ force: true });
  clueCanvas.getDeleteTool().click({ force: true });
  cy.get(".ReactModalPortal .modal-footer .modal-button.default").click();
  cy.get(tileSelector(tileId)).should("not.exist");
}

// Stop if another run's marker is recent, and delete older ones.
function clearEarlierMarkers() {
  cy.get(kCanvas).then($canvas => {
    const earlier = $canvas.find(".tool-tile").toArray()
      .map(tile => ({ id: tile.getAttribute("data-tool-id"), match: tile.textContent.match(kMarkerPattern) }))
      .filter(({ match }) => match);
    for (const { id, match } of earlier) {
      const minutesAgo = (Date.now() - Date.parse(match[1])) / 60000;
      if (match[1] !== kRunStart && minutesAgo < kRunInProgressMinutes) {
        throw new Error(
          `Another run of this spec added a marker ${Math.round(minutesAgo)} minutes ago (${match[1]}), ` +
          `so it is probably still running against the same student and assignment. Runs can't ` +
          `share a document safely: wait for it to finish, or use a different assignment.`
        );
      }
      cy.log(`deleting a leftover marker from ${match[1] === kRunStart ? "an earlier attempt" : match[1]}`);
      deleteTile(id);
    }
  });
}

// Add a text tile holding the marker, and yield its id.
function addMarkerTile(marker) {
  return cy.get(kCanvas).then($canvas => {
    const before = new Set($canvas.find(".tool-tile").toArray().map(tile => tile.getAttribute("data-tool-id")));
    clueCanvas.addTile("text");
    return cy.get(`${kCanvas} .tool-tile`).should($tiles => {
      const added = $tiles.toArray().map(tile => tile.getAttribute("data-tool-id")).filter(id => !before.has(id));
      // More than one new tile means another session is editing this document too.
      expect(added, "tiles added to the document while this run added one").to.have.length(1);
    }).then($tiles => {
      const tileId = $tiles.toArray().map(tile => tile.getAttribute("data-tool-id")).find(id => !before.has(id));
      textToolTile.enterTextInTile(tileSelector(tileId), marker);
      cy.get(tileSelector(tileId)).should("contain", marker);
      return cy.wrap(tileId, { log: false });
    });
  });
}

// Fails with a hint at the likely cause, rather than just "element not found".
function checkMarkerTile(tileId, marker, context) {
  cy.get(kCanvas).should($canvas => {
    expect($canvas.find(`[data-tool-id="${tileId}"]`).text(),
      `this run's text tile ${context} (if it's missing, another session may have saved over the document)`)
      .to.contain(marker);
  });
}

if (config) {
  context("Launching CLUE from a portal assignment", () => {
    it("student work persists across launches and is visible to the teacher", () => {
      const marker = `${kMarkerPrefix}${kRunStart} attempt ${Cypress.currentRetry + 1}`;

      cy.log("launch as the student and add text");
      cy.login(config.portalUrl, config.student);
      launch(config.studentLaunchUrl).as("studentClueUrl");
      cy.waitForLoad();
      checkVersion();
      openProblemDocument();
      clearEarlierMarkers();
      addMarkerTile(marker).as("markerTileId");
      cy.waitForSave();

      cy.log("launch again as the student and find the text");
      // A fresh launch, as after closing the window: nothing carried over in the browser.
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      launch(config.studentLaunchUrl);
      cy.waitForLoad();
      cy.get("@markerTileId").then(tileId => checkMarkerTile(tileId, marker, "after relaunching"));

      cy.log("launch as the teacher and find the student's text");
      cy.logout(config.portalUrl);
      cy.login(config.portalUrl, config.teacher);
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      launch(config.teacherLaunchUrl).then(teacherClueUrl => {
        // The report must run the same CLUE build against the same Firebase project as the
        // assignment, or the teacher sees none of the student's work. Checked from the portal's
        // redirects, so it holds for the portal's settings whichever build this run tests.
        cy.get("@studentClueUrl").then(studentClueUrl => {
          expect(teacherClueUrl.pathname, "report's CLUE path matches the assignment's")
            .to.eq(studentClueUrl.pathname);
          expect(teacherClueUrl.searchParams.get("firebaseEnv"), "report's firebaseEnv matches the assignment's")
            .to.eq(studentClueUrl.searchParams.get("firebaseEnv"));
        });
      });
      cy.waitForLoad();
      checkVersion();
      dashboard.switchView("Dashboard");
      // The dashboard shows each group's current work, the student's among it.
      dashboard.getGroups().should("contain", marker);

      cy.log("launch as the student again and remove this run's text");
      // Keeps the shared student's problem document from growing with every run. A run that
      // fails before this point leaves its tile behind for the next run to delete.
      cy.logout(config.portalUrl);
      cy.login(config.portalUrl, config.student);
      launch(config.studentLaunchUrl);
      cy.waitForLoad();
      cy.get("@markerTileId").then(tileId => deleteTile(tileId));
      cy.waitForSave();
    });
  });
} else {
  // Declaring no tests, rather than skipping one, keeps a run without these settings out of
  // the recorded test count. See cypress/support/portal-launch.js.
  // eslint-disable-next-line no-console
  console.log("portal launch spec: PORTAL_LAUNCH_* settings missing, so no tests are declared");
}
