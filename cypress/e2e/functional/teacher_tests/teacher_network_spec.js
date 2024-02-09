import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";
import TeacherNetwork from "../../../support/elements/common/TeacherNetwork";

let dashboard = new TeacherDashboard;
let clueCanvas = new ClueCanvas;
let teacherNetwork = new TeacherNetwork;

function beforeTest() {
  const queryParams = `${Cypress.config("clueTestqaUnitTeacher6")}`;
  cy.clearQAData('all');
  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
  cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
}

describe('Networked dividers for networked teacher', () => {
  it('verify network dividers for teacher in network (via url params)', () => {
    beforeTest();

    cy.log('verify network dividers in \'My Work\' tab for teacher in network');
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    cy.openSection('my-work', 'learning-log');
    teacherNetwork.verifyDividerLabel('learning-log', 'my-classes');
    teacherNetwork.verifyDividerLabel('learning-log', 'my-network');

    cy.log('verify network dividers in \'Class Work\' tab for teacher in network');
    cy.openTopTab("class-work");
    cy.openSection('class-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    cy.openSection('class-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    cy.openSection('class-work', 'learning-logs');
    teacherNetwork.verifyDividerLabel('learning-logs', 'my-classes');
    teacherNetwork.verifyDividerLabel('learning-logs', 'my-network');
  });
});
