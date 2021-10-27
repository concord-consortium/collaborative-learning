import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import TeacherNetwork from "../../../../support/elements/clue/TeacherNetwork";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;
let teacherNetwork = new TeacherNetwork;

const queryParams = "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa";

before(() => {
  cy.clearQAData('all');

  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
});
beforeEach(() => {
  cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
});

describe('Networked dividers for networked teacher', () => {
  it('verify network dividers for teacher in network (via url params)', () => {
    cy.visit("/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo");
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(2000);
    cy.get('.collapsed-resources-tab').click();
  });
  it('verify network dividers in \'My Work\' tab for teacher in network', () => {
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.verifyMyClassesDividerLabel('workspaces');
    // teacherNetwork.verifyMyNetworkDividerLabel('workspaces');

    cy.openSection('my-work', 'starred');
    teacherNetwork.verifyMyClassesDividerLabel('starred');
    // teacherNetwork.verifyMyNetworkDividerLabel('starred');

    cy.openSection('my-work', 'learning-log');
    teacherNetwork.verifyMyClassesDividerLabel('learning-log');
    // teacherNetwork.verifyMyNetworkDividerLabel('learning-log');
  });
  it('verify network dividers in \'Class Work\' tab for teacher in network', () => {
    cy.openTopTab("class-work");
    cy.openSection('class-work', 'problem-workspaces');
    teacherNetwork.verifyMyClassesDividerLabel('problem-workspaces');
    // teacherNetwork.verifyMyNetworkDividerLabel('problem-workspaces');

    cy.openSection('class-work', 'extra-workspaces');
    teacherNetwork.verifyMyClassesDividerLabel('extra-workspaces');
    // teacherNetwork.verifyMyNetworkDividerLabel('extra-workspaces');

    cy.openSection('class-work', 'learning-logs');
    teacherNetwork.verifyMyClassesDividerLabel('learning-logs');
    // teacherNetwork.verifyMyNetworkDividerLabel('learning-logs');

    cy.openSection('class-work', 'starred');
    teacherNetwork.verifyMyClassesDividerLabel('starred');
    // teacherNetwork.verifyMyNetworkDividerLabel('starred');
  });
  it('verify network dividers in \'Supports\' tab for teacher in network', () => {
    cy.openTopTab("supports");
    cy.openSection('supports', 'problem-supports');
    teacherNetwork.verifyMyClassesDividerLabel('problem-supports');
    // teacherNetwork.verifyMyNetworkDividerLabel('problem-supports');

    cy.openSection('supports', 'teacher-supports');
    teacherNetwork.verifyMyClassesDividerLabel('teacher-supports');
    // teacherNetwork.verifyMyNetworkDividerLabel('teacher-supports');
  });
});
