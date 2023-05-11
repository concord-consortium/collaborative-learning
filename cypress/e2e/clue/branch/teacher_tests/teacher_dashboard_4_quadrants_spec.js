import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";

let dashboard = new TeacherDashboard();

context('Teacher Dashboard View 4 Quadrants', () => {
    before(() => {
      const queryParams = "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6";
      cy.clearQAData('all');
      cy.visit(queryParams);
      cy.waitForLoad();
      dashboard.switchView("Dashboard");
      dashboard.switchWorkView('Published');
      cy.wait(8000);
      dashboard.clearAllStarsFromPublishedWork();
      dashboard.switchWorkView('Current');
    });

    beforeEach(() => {
      cy.fixture("teacher-dash-data-CLUE-test.json").as("clueData");
    });

    describe('4 quadrants functionality', () => {
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
            cy.get('.member').should('contain', "S1")
            .should('contain', "S2")
            .should('contain', "S3")
            .should('contain', "S4");
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

      // FIXME: this test was crashing my local cypress.
      it.skip('verify toggling the 4 quardrants in a 4 up view', () => {

        //North West Quardrants
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentID(0).should('contain', "S1").click();
        });
        dashboard.getZoomedStudentID().should('contain', "Student 1");
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 1);
        });
        dashboard.getPlaybackToolBar().should("exist");
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentCanvas(".north-east").should("not.exist");
          dashboard.getStudentCanvas(".south-east").should("not.exist");
          dashboard.getStudentCanvas(".south-west").should("not.exist");
        });
        dashboard.getZoomedStudentID().click();
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 4);
        });

        //North East Quardrants
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentID(1).should('contain', "S2").click();
        });
        dashboard.getZoomedStudentID().should('contain', "Student 2");
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 1);
        });
        dashboard.getPlaybackToolBar().should("exist");
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentCanvas(".north-west").should("not.exist");
          dashboard.getStudentCanvas(".south-east").should("not.exist");
          dashboard.getStudentCanvas(".south-west").should("not.exist");
        });
        dashboard.getZoomedStudentID().click();
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 4);
        });

        //South East Quardrants
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentID(2).should('contain', "S3").click();
        });
        dashboard.getZoomedStudentID().should('contain', "Student 3");
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 1);
        });
        dashboard.getPlaybackToolBar().should("exist");
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentCanvas(".north-west").should("not.exist");
          dashboard.getStudentCanvas(".north-east").should("not.exist");
          dashboard.getStudentCanvas(".south-west").should("not.exist");
        });
        dashboard.getZoomedStudentID().click();
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 4);
        });

        //South West Quardrants
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentID(3).should('contain', "S4").click();
        });
        dashboard.getZoomedStudentID().should('contain', "Student 4");
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 1);
        });
        dashboard.getPlaybackToolBar().should("exist");
        dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentCanvas(".north-west").should("not.exist");
          dashboard.getStudentCanvas(".north-east").should("not.exist");
          dashboard.getStudentCanvas(".south-east").should("not.exist");
        });
        dashboard.getZoomedStudentID().click();
        dashboard.getGroups().eq(0).within(() => {
          cy.get('.canvas-container').should("have.length", 4);
        });
      });
    });
  });
