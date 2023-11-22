import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";
import TeacherNetwork from "../../../support/elements/common/TeacherNetwork";

let dashboard = new TeacherDashboard;
let clueCanvas = new ClueCanvas;
let teacherNetwork = new TeacherNetwork;

const queryParams = "/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa";

function beforeTest(params) {
  cy.clearQAData('all');

  cy.visit(queryParams);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
  cy.fixture("teacher-dash-data-msa-test.json").as("clueData");
}

function loadNetworkTest() {
  cy.visit("/?appMode=qa&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:7&unit=msa&network=foo");
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
}

describe('Networked dividers for networked teacher', () => {
  it('verify network dividers for teacher in network (via url params)', () => {
    beforeTest(queryParams);
    loadNetworkTest();

    cy.log('verify network dividers in \'My Work\' tab for teacher in network');
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    // We are not showing network section with the document scroller in the Starred tab
    // cy.openSection('my-work', 'starred');
    // teacherNetwork.verifyDividerLabel('starred', 'my-classes');
    // teacherNetwork.verifyDividerLabel('starred', 'my-network');

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

    // We are not showing network section with the document scroller in the Starred tab
    // cy.openSection('class-work', 'starred');
    // teacherNetwork.verifyDividerLabel('starred', 'my-classes');
    // teacherNetwork.verifyDividerLabel('starred', 'my-network');
  });
});
