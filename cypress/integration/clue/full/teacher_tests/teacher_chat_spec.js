import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import ChatPanel from "../../../../support/elements/clue/ChatPanel";
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";
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

let dashboard = new TeacherDashboard;
let clueCanvas = new ClueCanvas;
let chatPanel = new ChatPanel;
let resourcesPanel = new ResourcesPanel;


const offeringId1 = "2000";
const offeringId2 = "2004";
const clueTeacher1 = {
  username: "TejalTeacher1",
  password: "ccpassword"
};
const clueTeacher2 = {
  username: "TejalTeacher2",
  password: "ccpassword"
};

describe('Teachers can communicate back and forth in chat panel', () => {
  it("login teacher1 and setup clue chat", () => {
    cy.login("https://learn.staging.concord.org", clueTeacher1);
    cy.launchReport('https://learn.staging.concord.org/portal/offerings/' + offeringId1 + '/external_report/49');
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(4000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
    cy.fixture("teacher-dash-data.json").as("clueData");
    resourcesPanel.getCollapsedResourcesTab().click();
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.getChatPanelToggle().click();
  });
  it("verify teacher1 can post document and tile comments", () => {
    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.addCommentAndVerify("This is a teacher1 document comment");
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.addCommentAndVerify("This is a teacher1 tile comment");
  });
  it("login teacher2 and setup clue chat", () => {
    cy.login("https://learn.staging.concord.org", clueTeacher2);
    cy.launchReport('https://learn.staging.concord.org/portal/offerings/' + offeringId2 + '/external_report/49');
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(4000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
    cy.fixture("teacher-dash-data.json").as("clueData");
    resourcesPanel.getCollapsedResourcesTab().click();
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.getChatPanelToggle().click();
  });
  it("verify teacher2 can view teacher1's comments and add more comments", () => {
    // Teacher 2 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher1 document comment");
    chatPanel.addCommentAndVerify("This is a teacher2 document comment");
    // Teacher 2 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains("This is a teacher1 tile comment");
    chatPanel.addCommentAndVerify("This is a teacher2 tile comment");
  });
  it("verify reopening teacher1's clue chat in the same network", () => {
    // Open clue chat for Teacher 1
    cy.login("https://learn.staging.concord.org", clueTeacher1);
    cy.launchReport('https://learn.staging.concord.org/portal/offerings/' + offeringId1 + '/external_report/49');
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(4000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
    cy.fixture("teacher-dash-data.json").as("clueData");
    resourcesPanel.getCollapsedResourcesTab().click();
    cy.openTopTab("problems");
    cy.openProblemSection("Introduction");
    chatPanel.getChatPanelToggle().click();
  });
  it("verify teacher1 can view teacher2's comments", () => {
    // Teacher 1 document comment
    chatPanel.verifyProblemCommentClass();
    chatPanel.verifyCommentThreadContains("This is a teacher2 document comment");
    // Teacher 1 tile comment
    cy.clickProblemResourceTile('introduction');
    chatPanel.verifyCommentThreadContains("This is a teacher2 tile comment");
  });
});
