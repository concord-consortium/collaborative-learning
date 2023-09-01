import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";

let dashboard = new TeacherDashboard();

function beforeTest() {
  const queryParams = "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6";
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Dashboard");
  dashboard.switchWorkView('Published');
  cy.wait(8000);
  dashboard.clearAllStarsFromPublishedWork();
  dashboard.switchWorkView('Current');
  cy.fixture("teacher-dash-data-CLUE-test.json").as("clueData");
  dashboard.getProblemDropdown().text().as('problemTitle');
}

context('6-pack view functionality', () => {
  it('verifies 6-pack view functionality', () => {
    beforeTest();
    cy.get('@clueData').then((clueData) => {
      let groups = clueData.classes[0].problems[0].groups;
      let groupIndex = 0;
      let studentIndex = 0;
      let tempGroupIndex = 0;
      let tempGroup = clueData.classes[0].problems[0].groups[tempGroupIndex];
      let progress = {
        "total": "30",
        "IN": "30",
        "IC": "9",
        "WI": "9",
        "NW": "7"
      };
      let groupName = groups[groupIndex].groupName;
      let studentID = groups[groupIndex].students[studentIndex].studentID;

      cy.log('verifies students are in correct groups');
      dashboard.getGroupName().eq(groupIndex).should('contain', 'Group ' + groupName);
      dashboard.getGroups().eq(groupIndex).within(() => {
        dashboard.getStudentID(studentIndex).should('contain', studentID);
      });

      cy.log('verify each canvas in a 4 up view is read only');
      dashboard.verifyWorkForGroupReadOnly(tempGroup);
      cy.wait(1000);

      cy.log('verifies section tool progress');
      dashboard.getTotalProgressNumber("IN").should('contain', progress.total);
      dashboard.getTotalProgressNumber("IC").should('contain', progress.total);
      dashboard.getTotalProgressNumber("WI").should('contain', progress.total);
      dashboard.getTotalProgressNumber("NW").should('contain', progress.total);
      dashboard.getCurrentProgressNumber("IN").should('contain', progress.IN);
      dashboard.getCurrentProgressNumber("IC").should('contain', progress.IC);
      dashboard.getCurrentProgressNumber("WI").should('contain', progress.WI);
      dashboard.getCurrentProgressNumber("NW").should('contain', progress.NW);

      cy.log('can switch pages');
      dashboard.getGroups().should('have.length', 6);
      dashboard.getPreviousPageButton().should('have.class', 'disabled').and('be.visible');
      dashboard.getNextPageButton().should('not.have.class', 'disabled').and('be.visible');
      dashboard.getNextPageButton().click({ force: true });
      dashboard.getGroups().should('have.length', 3);
      dashboard.getNextPageButton().should('have.class', 'disabled');
      dashboard.getPreviousPageButton().should('not.have.class', 'disabled');
      dashboard.getPreviousPageButton().click({ force: true });
      dashboard.getPreviousPageButton().should('have.class', 'disabled');
      dashboard.getGroups().should('have.length', 6);
      dashboard.getNextPageButton().should('not.have.class', 'disabled');
    });
    it('6-pack view functionality - Published Work', () => {
      beforeTest();
      cy.get('@clueData').then((clueData) => {
        let classIndex = 0;
        let problemIndex = 0;
        let groupIndex = 0;
        let group;

        cy.log('switches to published work tab and checks UI options');
        dashboard.switchWorkView("Published");
        group = clueData.classes[classIndex].problems[problemIndex].groups[groupIndex];
        cy.wait(3000); //need to wait for canvases to load
        dashboard.verifyPublishStatus(group);

        cy.log('select stars for students');
        groups = clueData.classes[classIndex].problems[problemIndex].groups;
        dashboard.clearAllStarsFromPublishedWork();
        dashboard.starPublishedWork(groups);

        cy.log('removes all stars from student published work');
        dashboard.getStarPublishIcon().should('have.class', 'starred');
        dashboard.getStarPublishIcon().click({ force: true, multiple: true });
        dashboard.getStarPublishIcon().should('not.have.class', 'starred');
      });
    });
  });
});
