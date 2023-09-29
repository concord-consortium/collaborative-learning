import ChatPanel from "../../../../support/elements/clue/ChatPanel";
import TeacherNetwork from "../../../../support/elements/clue/TeacherNetwork";
import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
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

let chatPanel = new ChatPanel;
let teacherNetwork = new TeacherNetwork;
let dashboard = new TeacherDashboard();

const portalUrl = "https://learn.portal.staging.concord.org";
const offeringId1 = "221";
const reportUrl1 = "https://learn.portal.staging.concord.org/portal/offerings/" + offeringId1 + "/external_report/11";
const clueTeacher1 = {
  username: "clueteachertest1",
  password: "password",
  firstname: "Clue",
  lastname: "Teacher1"
};

function beforeTest() {
  cy.login(portalUrl, clueTeacher1);
  cy.launchReport(reportUrl1);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(4000);
}

describe('Teachers can see network dividers', () => {
  // TODO: Re-instate the skipped tests below once learn.staging.concord.org is fully functional again
  it('verify network dividers in My Work tab for teacher in network', () => {
    beforeTest();
    cy.openTopTab("my-work");
    cy.openSection('my-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    // cy.openSection('my-work', 'starred');
    // teacherNetwork.verifyDividerLabel('starred', 'my-classes');
    // teacherNetwork.verifyDividerLabel('starred', 'my-network');

    cy.openSection('my-work', 'learning-log');
    teacherNetwork.verifyDividerLabel('learning-log', 'my-classes');
    teacherNetwork.verifyDividerLabel('learning-log', 'my-network');
  });

  it('verify network dividers in Class Work tab for teacher in network', () => {
    beforeTest();
    cy.openTopTab("class-work");
    cy.openSection('class-work', 'workspaces');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-classes');
    teacherNetwork.verifyDividerLabel('workspaces', 'my-network');

    cy.openSection('class-work', 'learning-logs');
    teacherNetwork.verifyDividerLabel('learning-logs', 'my-classes');
    teacherNetwork.verifyDividerLabel('learning-logs', 'my-network');

    // cy.openSection('class-work', 'starred');
    // teacherNetwork.verifyDividerLabel('starred', 'my-classes');
    // teacherNetwork.verifyDividerLabel('starred', 'my-network');
  });
});
