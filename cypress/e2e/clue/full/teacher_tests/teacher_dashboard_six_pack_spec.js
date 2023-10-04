import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";

let dashboard = new TeacherDashboard();

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

context("Teacher Space", () => {

  const clueTeacher = {
    username: "clueteachertest1",
    password: "password"
  };

  function beforeTest() {
    cy.login("https://learn.portal.staging.concord.org", clueTeacher);
    // insert offering number for your activity below
    cy.launchReport('https://learn.portal.staging.concord.org/portal/offerings/221/external_report/11');
    cy.waitForLoad();

    dashboard.switchView("Dashboard");
    dashboard.switchWorkView('Published');
    dashboard.clearAllStarsFromPublishedWork();
    dashboard.switchWorkView('Current');
    cy.fixture("teacher-dash-data.json").as("clueData");
  }

  context('Teacher Dashboard View', () => {
    it('verify switching classes changes six pack content', () => {
      beforeTest();
      cy.get('@clueData').then((clueData) => {
        const initClassIndex = 0;
        const tempClassIndex = 1;
        let initClass = clueData.classes[initClassIndex];
        let tempClass = clueData.classes[tempClassIndex];
        let className = tempClass.className;
        let initClassName = initClass.className;

        dashboard.switchView("Dashboard");
        dashboard.getClassDropdown().should('contain', initClassName);
        dashboard.getGroups().should('have.length', 6);
        dashboard.getClassDropdown().click({ force: true }).then(() => {
          dashboard.getClassList().contains(className).click({ force: true });
          // cy.wait(1000)
          cy.waitForLoad();
          dashboard.switchView("Dashboard");
        });
        dashboard.getClassDropdown().should('contain', className);
        dashboard.getGroups().should('have.length', 1);

        //switch back to original problem for later test
        dashboard.getClassDropdown().click({ force: true });
        dashboard.getClassList().find('.list-item').contains(initClassName).click({ force: true });
        // cy.wait(1000)
        cy.waitForLoad();
      });
    });
  });
});
