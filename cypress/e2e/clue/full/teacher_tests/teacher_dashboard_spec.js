import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";

let dashboard = new TeacherDashboard();
const clueTeacher = {
  username: "clueteachertest",
  password: "password"
};
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


function beforeTest() {
  cy.login("https://learn.concord.org", clueTeacher);
  // insert offering number for your activity below
  cy.launchReport('https://learn.concord.org/portal/offerings/40557/external_report/25');
  cy.waitForLoad();

  dashboard.switchView("Dashboard");
  dashboard.switchWorkView('Published');
  dashboard.clearAllStarsFromPublishedWork();
  dashboard.switchWorkView('Current');
  cy.fixture("teacher-dash-data.json").as("clueData");
}

context('Teacher Dashboard View', () => {
  it('verify header elements', () => {
    beforeTest();
    cy.get('@clueData').then((clueData) => {
      let tempClass = clueData.classes[0];

      // Check Investigation Name visibility
      dashboard.getInvestigationTitle().should('be.visible').and('contain', clueData.investigationTitle);
      // Check problem list  UI and visibility
      dashboard.getProblemList().should('not.have.class', 'show');
      dashboard.getProblemDropdown().should('be.visible').click({ force: true });
      dashboard.getProblemList().should('exist').and('have.class', 'show');
      dashboard.getProblemList().find('.list-item').should('have.length', tempClass.problemTotal);
      dashboard.getProblemDropdown().click({ force: true });
      dashboard.getProblemList().should('not.have.class', 'show');
      // Check class list UI and visibility
      dashboard.getClassList().should('not.have.class', 'show');
      dashboard.getClassDropdown().should('contain', clueData.teacherName).and('contain', tempClass.className);
      dashboard.getClassDropdown().should('be.visible').click({ force: true });
      dashboard.getClassList().should('exist').and('have.class', 'show');
      dashboard.getClassList().find('.list-item').should('have.length', clueData.classes.length);
      dashboard.getClassDropdown().click({ force: true });
      dashboard.getClassList().should('not.have.class', 'show');
      // Check Teacher Username visibility and content
      // header.getUserName().should('be.visible').and('contain', clueData.teacherName)
    });
  });
  it('verifies six pack and group names', () => { //check this test again
    beforeTest();
    cy.get('@clueData').then((clueData) => {
      let tempGroupIndex = 0;
      let groups = clueData.classes[0].problems[0].groups;
      let group = groups[tempGroupIndex];

      // Check for group title
      dashboard.getSixPackView().should('exist').and('be.visible');
      dashboard.getGroupName().eq(group.groupIndex).should('contain', group.groupName);
      // Check for group length (4Up Count)
      dashboard.getSixPackView().then(() => {
        dashboard.getFourUpViews().should('have.length', 6);
      });
    });
  });
  it('verify switching problems changes six pack content and problem title', () => {
    beforeTest();
    cy.get('@clueData').then((clueData) => {
      let problems = clueData.classes[0].problems;
      let initProblemIndex = 0;
      let tempProblemIndex = 1;

      dashboard.getProblemDropdown().text().should('not.contain', problems[tempProblemIndex].problemTitle);
      dashboard.getGroups().should('have.length', 6);
      dashboard.getProblemDropdown().click({ force: true }).then(() => {
        dashboard.getProblemList().should('have.class', 'show');
        dashboard.getProblemList().find('.list-item').contains(problems[tempProblemIndex].problemTitle).click({ force: true });
        // cy.wait(1000);
        cy.waitForLoad();
        tempProblemIndex += 1;
      });
      dashboard.getProblemDropdown().should('contain', problems[tempProblemIndex].problemTitle);
      dashboard.getGroups().should('have.length', 0);

      //switch back to original problem for later test
      dashboard.getProblemDropdown().click({ force: true });
      dashboard.getProblemList().find('.list-item').contains(problems[initProblemIndex].problemTitle).click({ force: true });
      // cy.wait(1000);
      cy.waitForLoad();
    });
  });
  it('verify selected class is shown in class dropdown', () => {
    beforeTest();
    cy.get('@clueData').then((clueData) => {
      let initialClassIndex = 0;
      let tempClass = clueData.classes[initialClassIndex];

      dashboard.getClassDropdown().should('contain', tempClass.className).and('be.visible');
    });
  });
});
