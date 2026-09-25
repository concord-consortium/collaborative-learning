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
// The users and assignment are shared between runs, so each run writes text unique to it and
// looks only for that — earlier runs' leftovers, or a concurrent run, do not affect the result.
const config = portalLaunchConfig();

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

if (config) {
  context("Launching CLUE from a portal assignment", () => {
    it("student work persists across launches and is visible to the teacher", () => {
      const marker = `Portal launch check ${new Date().toISOString()}`;

      cy.log("launch as the student and add text");
      cy.login(config.portalUrl, config.student);
      launch(config.studentLaunchUrl).as("studentClueUrl");
      cy.waitForLoad();
      checkVersion();
      openProblemDocument();
      clueCanvas.addTile("text");
      textToolTile.enterText(marker);
      textToolTile.getTextTile().last().should("contain", marker);
      cy.waitForSave();

      cy.log("launch again as the student and find the text");
      // A fresh launch, as after closing the window: nothing carried over in the browser.
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      launch(config.studentLaunchUrl);
      cy.waitForLoad();
      textToolTile.getTextTile().should("contain", marker);

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
      // fails before this point leaves its tile behind; later runs are unaffected by it.
      cy.logout(config.portalUrl);
      cy.login(config.portalUrl, config.student);
      launch(config.studentLaunchUrl);
      cy.waitForLoad();
      cy.contains(".primary-workspace .text-tool-wrapper", marker).click({ force: true });
      clueCanvas.getDeleteTool().click({ force: true });
      cy.get(".ReactModalPortal .modal-footer .modal-button.default").click();
      cy.get(".primary-workspace").should("not.contain", marker);
      cy.waitForSave();
    });
  });
} else {
  // Declaring no tests, rather than skipping one, keeps a run without these settings out of
  // the recorded test count. See cypress/support/portal-launch.js.
  // eslint-disable-next-line no-console
  console.log("portal launch spec: PORTAL_LAUNCH_* settings missing, so no tests are declared");
}
