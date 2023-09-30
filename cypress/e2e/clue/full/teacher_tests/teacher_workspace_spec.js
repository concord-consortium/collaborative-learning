import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";

/**
 * Notes:
 *
 * Teacher dashboard test needs static data from 'clueteachertest's class 'CLUE'
 * Here is the ID for the class in firebase: a1f7b8f8b7b1ad1d2d6240c41bd2354d8575ee09ae8bd641
 *
 * Currently issues with problem switcher/class switcher. Maybe split these into two tests. Have this test
 * log into portal with data that doesn't need to be static.
 *
 * -> This may also help with issue when verifying read-only student canvases which is currently looping through
 *    all of the students in the dashboard's current view
 */

context("Teacher Workspace", () => {

  let dashboard = new TeacherDashboard();
  let clueCanvas = new ClueCanvas;
  let tableToolTile = new TableToolTile;
  let drawToolTile = new DrawToolTile;

  let teacherDoc = "Personal Doc 3";


  const portalUrl = "https://learn.portal.staging.concord.org";
  const offeringId1 = "221";
  const reportUrl1 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId1 + "/external_report/11";
  const clueTeacher1 = {
    username: "clueteachertest1",
    password: "password",
    firstname: "Clue",
    lastname: "Teacher1"
  };
  const class1 = "CLUE";
  const class2 = "CLUE A";

  function beforeTest() {
    cy.login(portalUrl, clueTeacher1);
    cy.launchReport(reportUrl1);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(4000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
    cy.collapseResourceTabs();
    cy.fixture("teacher-dash-data.json").as("clueData");
    cy.wait(2000);
  }

  describe('Multiple classes', function () {
    it('verify restore after switching classes', function () {
      beforeTest();
      clueCanvas.addTile('drawing');
      dashboard.getClassDropdown().click({ force: true });
      dashboard.getClassList().find('.list-item').contains(class2).click({ force: true });
      cy.waitForLoad();
      dashboard.getClassDropdown().should('contain', class2);
      dashboard.switchView('Workspace & Resources');
      drawToolTile.getDrawTile().should('not.exist');
      //switch back to original problem for later test
      dashboard.getClassDropdown().click({ force: true });
      dashboard.getClassList().find('.list-item').contains(class1).click({ force: true });
      cy.waitForLoad();
      dashboard.switchView('Workspace & Resources');
      drawToolTile.getDrawTile().should('exist');
    });
    //TODO: need to create another activity to assign to class
    it('verify restore after switching investigation', function () {
      beforeTest();
      cy.get('@clueData').then((clueData) => {
        let problems = clueData.classes[0].problems;
        let initProblemIndex = 0;
        let tempProblemIndex = 1;

        dashboard.getProblemDropdown().click({ force: true }).then(() => {
          dashboard.getProblemList().should('have.class', 'show');
          dashboard.getProblemList().find('.list-item').contains(problems[tempProblemIndex].problemTitle).click({ force: true });
          cy.waitForLoad();
          tempProblemIndex += 1;
        });
        dashboard.getProblemDropdown().should('contain', problems[tempProblemIndex].problemTitle);
        dashboard.switchView('Workspace & Resources');
        clueCanvas.getInvestigationCanvasTitle().should('contain', problems[tempProblemIndex].problemTitle);
        tableToolTile.getTableTile().should('not.exist');
        drawToolTile.getDrawTile().should('not.exist');
        //switch back to original problem to verify restore
        dashboard.getProblemDropdown().click({ force: true });
        dashboard.getProblemList().find('.list-item').contains(problems[initProblemIndex].problemTitle).click({ force: true });
        cy.waitForLoad();
        dashboard.switchView('Workspace & Resources');
        // cy.openResourcesTab();
        cy.openTopTab("my-work");
        cy.openSection('my-work', 'workspaces');
        clueCanvas.getInvestigationCanvasTitle().should('contain', problems[initProblemIndex].problemTitle);
        // tableToolTile.getTableTile().should('exist');
        drawToolTile.getDrawTile().should('exist');
        cy.openTopTab("my-work");
        cy.openSection('my-work', 'workspaces');
        cy.getCanvasItemTitle("workspaces").contains(teacherDoc).should('exist');
        cy.openDocumentWithTitle("my-work", "workspaces", teacherDoc);
        cy.wait(2000);
        tableToolTile.getTableTile().should('exist');
      });
    });
    it('verify teacher document publish to multiple classes', function () {
      beforeTest();
      cy.get('@clueData').then((clueData) => {
        let problems = clueData.classes[0].problems;
        let initProblemIndex = 0;

      clueCanvas.publishTeacherDocToMultipleClasses();
      cy.openResourceTabs();
      cy.openTopTab("class-work");
      cy.getCanvasItemTitle('workspaces').contains(problems[initProblemIndex].problemTitle).should('exist');
      dashboard.getClassDropdown().click({ force: true });
      dashboard.getClassList().find('.list-item').contains(class2).click({ force: true });
      cy.waitForLoad();
      dashboard.switchView('Workspace & Resources');
      // cy.openResourceTabs();
      cy.openTopTab("class-work");
      cy.getCanvasItemTitle('workspaces').contains(problems[initProblemIndex].problemTitle).should('exist');
      });
    });
  });
  after(function () {
    beforeTest();
    //switch back to original problem for later test
    dashboard.getClassDropdown().click({ force: true });
    dashboard.getClassList().find('.list-item').contains(class1).click({ force: true });
    cy.waitForLoad();
    dashboard.switchView('Workspace & Resources');
    drawToolTile.getDrawTile().should('exist');
    clueCanvas.deleteTile('draw');
  });
});
