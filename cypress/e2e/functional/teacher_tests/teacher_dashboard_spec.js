import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;

function beforeTest() {
  const queryParams = `${Cypress.config("clueTestqaUnitTeacher6")}`;
  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Dashboard");
  dashboard.switchWorkView('Published');
  cy.wait(8000);
  dashboard.clearAllStarsFromPublishedWork();
  dashboard.switchWorkView('Current');
  cy.fixture("teacher-dash-data-CLUE-test.json").as("clueData");
}

context('Teacher Dashboard View', () => {
  it('verify header elements', () => {
    beforeTest();
    cy.get('@clueData').then((clueData) => {
      let tempClass = clueData.classes[0];
      let tempGroupIndex = 0;
      let groups = clueData.classes[0].problems[0].groups;
      let group = groups[tempGroupIndex];
      let sectionIDArr = ["IN", "IC", "WI", "NW"];

      cy.log('verify Investigation Name visibility');
      dashboard.getInvestigationTitle().should('be.visible').and('contain', clueData.investigationTitle);

      cy.log('verify problem list  UI and visibility');
      dashboard.getProblemList().should('not.have.class', 'show');
      dashboard.getProblemDropdown().should('be.visible').click({ force: true });
      dashboard.getProblemList().should('exist').and('have.class', 'show');
      dashboard.getProblemList().find('.list-item').should('have.length', tempClass.problemTotal);
      dashboard.getProblemDropdown().click({ force: true });
      dashboard.getProblemList().should('not.have.class', 'show');

      cy.log('verify class list UI and visibility');
      dashboard.getClassList().should('not.exist');
      dashboard.getClassDropdown().should('contain', clueData.teacherName);
      dashboard.getClassDropdown().should('be.visible').click({ force: true });

      cy.log('verify Dashboard and Workspace toggle default');
      dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected');
      dashboard.getViewToggle('Workspace & Resources').should('be.visible').and('not.have.class', 'selected');

      cy.log('verify for group title');
      dashboard.getSixPackView().should('exist').and('be.visible');
      dashboard.getGroupName().eq(group.groupIndex).should('contain', group.groupName);

      cy.log('verify for group length (4Up Count)');
      dashboard.getSixPackView().then(() => {
        dashboard.getFourUpViews().should('have.length', 6);
      });

      cy.log('verify current and published toggle button appear and work');
      dashboard.getWorkToggle("Current").should('have.class', 'selected').and('be.visible');
      dashboard.getWorkToggle("Published").should('not.have.class', 'selected').and('be.visible').click({ force: true });
      dashboard.getWorkToggle("Current").should('not.have.class', 'selected');
      dashboard.getWorkToggle("Published").should('have.class', 'selected');
      dashboard.getWorkToggle("Current").click({ force: true });

      cy.log('verify Progress area displays progress icons');
      sectionIDArr.forEach((section) => {
        dashboard.getSectionProgressIcons(section).should('be.visible');
      });

      cy.log('verify Progress area displays progress numbers');
      sectionIDArr.forEach((section) => {
        dashboard.getTotalProgressNumber(section).should('be.visible');
        dashboard.getCurrentProgressNumber(section).should('be.visible');
      });

      cy.log('verify six-pack page toggle'); //only passes if there are more 6 groups in the class
      dashboard.getPreviousPageButton().should('be.visible').and('have.class', 'disabled');
      dashboard.getNextPageButton().should('be.visible').and('not.have.class', 'disabled');

      cy.log('dashboard/workspace switch changes workspace view');
      dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected');
      clueCanvas.getSingleWorkspace().should('not.exist');
      dashboard.getViewToggle('Workspace & Resources').should('be.visible').and('not.have.class', 'selected');
      dashboard.getViewToggle('Workspace & Resources').click({ force: true });
      dashboard.getViewToggle("Workspace & Resources").should('have.class', 'selected');
      clueCanvas.getSingleWorkspace().should('be.visible');
      dashboard.getViewToggle("Dashboard").click({ force: true });
      dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected');
    });
  });
});
