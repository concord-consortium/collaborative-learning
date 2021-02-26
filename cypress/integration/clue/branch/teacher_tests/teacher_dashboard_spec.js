import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;

before(() => {
  const queryParams = "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6";
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForSpinner();
  dashboard.switchWorkView('Published');
  dashboard.clearAllStarsFromPublishedWork();
  dashboard.switchWorkView('Current');
});

beforeEach(() => {
  cy.fixture("teacher-dash-data-CLUE-test.json").as("clueData");
});

context('Teacher Dashboard View', () => {
  describe('UI visibility', () => {
    it('verify header elements', () => {
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
        dashboard.getClassList().should('not.exist');
        dashboard.getClassDropdown().should('contain', clueData.teacherName);
        // dashboard.getClassDropdown().should('contain',tempClass.className);
        dashboard.getClassDropdown().should('be.visible').click({ force: true });
        // Check Dashboard and Workspace toggle default
        dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected');
        dashboard.getViewToggle('Workspace').should('be.visible').and('not.have.class', 'selected');
      });
    });
    it('verifies six pack and group names', () => { //check this test again
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
    it('verify current and published toggle button appear and work', () => {
      dashboard.getWorkToggle("Current").should('have.class', 'selected').and('be.visible');
      dashboard.getWorkToggle("Published").should('not.have.class', 'selected').and('be.visible').click({ force: true });
      dashboard.getWorkToggle("Current").should('not.have.class', 'selected');
      dashboard.getWorkToggle("Published").should('have.class', 'selected');
      dashboard.getWorkToggle("Current").click({ force: true });
    });
    describe('Progress area', () => {
      let sectionIDArr = ["IN", "IC", "WI", "NW"];
      it('displays progress icons', () => {
        sectionIDArr.forEach((section) => {
          dashboard.getSectionProgressIcons(section).should('be.visible');
        });
      });
      it('displays progress numbers', () => {
        sectionIDArr.forEach((section) => {
          dashboard.getTotalProgressNumber(section).should('be.visible');
          dashboard.getCurrentProgressNumber(section).should('be.visible');
        });
      });
    });
    it('verify six-pack page toggle', () => { //only passes if there are more 6 groups in the class
      dashboard.getPreviousPageButton().should('be.visible').and('have.class', 'disabled');
      dashboard.getNextPageButton().should('be.visible').and('not.have.class', 'disabled');
    });
  });
  describe('Header element functionality', () => {
    it('verify dashboard/workspace switch changes workspace view', () => {
      dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected');
      clueCanvas.getSingleWorkspace().should('not.exist');
      dashboard.getViewToggle('Workspace').should('be.visible').and('not.have.class', 'selected');
      dashboard.getViewToggle('Workspace').click({ force: true });
      dashboard.getViewToggle("Workspace").should('have.class', 'selected');
      clueCanvas.getSingleWorkspace().should('be.visible');
      dashboard.getViewToggle("Dashboard").click({ force: true });
      dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected');
    });
  });

  describe('6-pack view functionality - Current Work', () => {
    before(function () {
      dashboard.getProblemDropdown().text().as('problemTitle');
    });
    it('verifies students are in correct groups', () => {
      cy.get('@clueData').then((clueData) => {
        let groups = clueData.classes[0].problems[0].groups;
        let groupIndex = 0;
        let studentIndex = 0;

        let groupName = groups[groupIndex].groupName;
        let studentID = groups[groupIndex].students[studentIndex].studentID;

        dashboard.getGroupName().eq(groupIndex).should('contain', 'Group ' + groupName);
        dashboard.getGroups().eq(groupIndex).within(() => {
          dashboard.getStudentID(studentIndex).should('contain', studentID);
        });
      });
    });
    it('verify each canvas in a 4 up view is read only', () => {
      cy.get('@clueData').then((clueData) => {
        let tempGroupIndex = 0;
        let tempGroup = clueData.classes[0].problems[0].groups[tempGroupIndex];
        dashboard.verifyWorkForGroupReadOnly(tempGroup);
        cy.wait(1000);
      });
    });
    it('verifies section tool progress', () => { //currently hard coded since we are using a static test class
      // total = 30, IN = 29, IC = 9, WI = 10, NW = 7
      let progress = {
        "total": "29",
        "IN": "29",
        "IC": "9",
        "WI": "9",
        "NW": "7"
      };
      dashboard.getTotalProgressNumber("IN").should('contain', progress.total);
      dashboard.getTotalProgressNumber("IC").should('contain', progress.total);
      dashboard.getTotalProgressNumber("WI").should('contain', progress.total);
      dashboard.getTotalProgressNumber("NW").should('contain', progress.total);
      dashboard.getCurrentProgressNumber("IN").should('contain', progress.IN);
      dashboard.getCurrentProgressNumber("IC").should('contain', progress.IC);
      dashboard.getCurrentProgressNumber("WI").should('contain', progress.WI);
      dashboard.getCurrentProgressNumber("NW").should('contain', progress.NW);
    });
    it('can switch pages', () => {
      // Use when clue class has LESS than 6 groups
      // dashboard.getPreviousPageButton().should('exist').and('not.be.visible').and('have.class', 'disabled')
      // dashboard.getNextPageButton().should('exist').and('not.be.visible').and('have.class', 'disabled')

      // Use when clue class has MORE than 6 groups
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
  });
  describe('6-pack view functionality - Published Work', () => {
    it('switches to published work tab and checks UI options', () => {
      // not working - nocan't get to the right canvas
      let classIndex = 0;
      let problemIndex = 0;
      let groupIndex = 0;
      let group;

      dashboard.switchWorkView("Published");
      cy.get('@clueData').then((clueData) => {
        group = clueData.classes[classIndex].problems[problemIndex].groups[groupIndex];
        cy.wait(3000); //need to wait for canvases to load
        dashboard.verifyPublishStatus(group);
      });

    });
    it('select stars for students', () => { // Want this to be for all students once it passes
      let classIndex = 0;
      let problemIndex = 0;
      let groups;

      cy.get('@clueData').then((clueData) => {
        groups = clueData.classes[classIndex].problems[problemIndex].groups;
        dashboard.clearAllStarsFromPublishedWork();
        dashboard.starPublishedWork(groups);
      });
    });
    it('removes all stars from student published work', () => {
      dashboard.getStarPublishIcon().should('have.class', 'starred');
      dashboard.getStarPublishIcon().click({ force: true, multiple: true });
      dashboard.getStarPublishIcon().should('not.have.class', 'starred');
    });
  });
  describe('6-pack view live updates', () => {
    it('verify 4up views in 6 pack are updated as student makes changes', () => {
      /**
       * Check for current existing element in student canvas
       * Visit student link
       * Do some work as student
       * Verify that there were changes/new elements
       */
    });
  });
  describe('support message appears in student view', () => {
    const textToStudent = "This is a note to clue testing1";
    const textToGroup = "This is a note to Group 3";

    before(function () {
      let group = 1,
          studentName = "Student 1",
          quadrant = "north-west";

      dashboard.sendGroupNote(2, textToGroup);
      dashboard.sendStudentNote(group, studentName, quadrant, textToStudent);
    });

    it('verify student support note appears in student view', function () {
      cy.visit('/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:1&qaGroup=1');
      cy.wait(5000);
      cy.get('#icon-sticky-note').should('exist').click({force:true});
      cy.get('#icon-sticky-note').click({force:true});
      cy.get('.sticky-note-popup').should('exist');
      cy.get('.sticky-note-popup-item-content').should('contain', textToStudent);
    });
    it("verify student support note is not in another student's view", function () {
      cy.visit('/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:3&qaGroup=1');
      cy.wait(3000);
      cy.get('#icon-sticky-note').should('not.exist');
    });
    it('verify group support note appears in student view', function () {
      cy.visit('/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:10&qaGroup=3');
      cy.wait(5000);
      cy.get('#icon-sticky-note').should('exist').click({force:true});
      cy.get('#icon-sticky-note').click({force:true});
      cy.get('.sticky-note-popup').should('exist');
      cy.get('.sticky-note-popup-item-content').should('contain', textToGroup);
    });
    it('verify group support note not in student view in different group', function () {
      cy.visit('/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:7&qaGroup=2');
      cy.wait(3000);
      cy.get('#icon-sticky-note').should('not.exist');
    });
  });
});
