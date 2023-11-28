import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ClueCanvas from "../../../support/elements/common/cCanvas";
import ChatPanel from "../../../support/elements/common/ChatPanel";
import Canvas from '../../../support/elements/common/Canvas';
import Scrolling from '../../../support/elements/common/Scrolling';
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";

let dashboard = new TeacherDashboard();
let clueCanvas = new ClueCanvas;
let chatPanel = new ChatPanel;
const canvas = new Canvas;
const scrolling = new Scrolling;
const resourcesPanel = new ResourcesPanel;

const queryParams = {
  sas3_1: "/?appMode=demo&demoName=CLUE&fakeClass=1&fakeUser=teacher:1&unit=sas&problem=3.1",
  sas1_1: "/?appMode=demo&demoName=CLUE&fakeClass=1&fakeUser=teacher:1&unit=sas&problem=1.1",
  msa: "/?appMode=demo&demoName=CLUE&fakeClass=1&fakeUser=teacher:1&unit=msa&problem=1.3"
};

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Workspace & Resources");
  cy.wait(2000);
  clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
}

context('Vertical Scrolling', () => {
  describe('Vertical scrolling in various places', () => {   
    it('verify scrolling in Resources', () => {
      cy.log('verify vertical scrolling under problem subtabs');
      beforeTest(queryParams.msa);
      cy.log('verify introduction subtab');
      cy.openProblemSection("Initial Challenge");
      cy.clickProblemResourceTile('initialChallenge');
      cy.wait(10000);
      scrolling.verifyScrolling('initialChallenge');

      cy.log('verify vertical scrolling under teacher guide subtabs');
      cy.log('verify launch subtab');
      cy.openTopTab("teacher-guide");
      cy.openProblemSection('Launch');
      cy.clickProblemResourceTile('launch');
      cy.wait(10000);
      scrolling.verifyScrolling('launch');
    });
    it('verify scrolling in Dashboard', () => {
      beforeTest(queryParams.sas1_1);
      cy.wait(20000);
      dashboard.switchView("Dashboard");
      dashboard.getWorkToggle("Current").should('have.class', 'selected').and('be.visible');
      cy.log('verify scrolling under current work')
      scrolling.verifyDashboard();
      
      cy.log('verify scrolling under published work');
      dashboard.getWorkToggle("Published").should('not.have.class', 'selected').and('be.visible').click({ force: true });
      cy.wait(10000);
      dashboard.getWorkToggle("Published").should('have.class', 'selected');
      scrolling.verifyDashboard();

      cy.log('verify scrolling for individual student workspace 4-up view');
      dashboard.getWorkToggle("Current").should('not.have.class', 'selected').and('be.visible').click({ force: true });
      cy.wait(10000);
      dashboard.getGroups().eq(0).within(() => {
          dashboard.getStudentCanvas(".north-east").find("[data-testid='document-content'] .tile-row").last().should("not.be.visible");
          dashboard.getStudentCanvas(".north-east").find("[data-testid='document-content'] .tile-row").last().scrollIntoView();
          cy.wait(1000);
          dashboard.getStudentCanvas(".north-east").find("[data-testid='document-content'] .tile-row").last().scrollIntoView();
          dashboard.getStudentCanvas(".north-east").find("[data-testid='document-content'] .tile-row").last().should("be.visible");
        });
      
      cy.log('verify scrolling for individual student workspace');
      dashboard.getWorkToggle("Current").should('have.class', 'selected').and('be.visible');
      cy.wait(2000);
      dashboard.getGroups().eq(0).within(() => {
        dashboard.getStudentID(0).should('contain', "S1").click();
      });  
      dashboard.getGroups().eq(0).within(() => {
        dashboard.getStudentCanvas(".north-west").find('#section_NW').should("not.be.visible");
        dashboard.getStudentCanvas(".north-west").find('#section_NW').scrollIntoView();
        dashboard.getStudentCanvas(".north-west").find('#section_NW').should("be.visible");
      });
    });
    it('verify scrolling in workspace', () => {
      beforeTest(queryParams.sas1_1);
      cy.log("verify problem Document");
      cy.get(".primary-workspace #section_NW").should("not.be.visible");
      cy.get(".primary-workspace #section_NW").scrollIntoView();
      cy.get(".primary-workspace #section_NW").should("be.visible");

      cy.log("verify personal document");
      const title = "0.1 Intro to CLUE";
      cy.openTopTab("my-work");
      cy.wait(20000);
      cy.openDocumentWithTitle('my-work', 'workspaces', title);
      cy.get(".primary-workspace #section_NW").should("not.be.visible");
      cy.get(".primary-workspace #section_NW").scrollIntoView();
      cy.get(".primary-workspace #section_NW").should("be.visible");
    });
    it('verify scrolling in my work', () => {
      beforeTest(queryParams.sas1_1);
      cy.wait(20000);
      cy.log("verify my work - workspaces");
      cy.openTopTab("my-work");
      cy.openSection("my-work", "workspaces");
      cy.wait(10000);
      scrolling.verifyScrollingWorkspaces();

      cy.log("Star documents");
      scrolling.starCanvasItem("my-work", "workspaces", "0.1 Intro to CLUE");
      scrolling.starMultipleCanvasItem("my-work", "workspaces");

      cy.log("verify My Work - starred");
      cy.openSection("my-work", "starred");
      cy.wait(10000);
      
      cy.log("verify my work - starred single flipper view scrolling");
      scrolling.verifyScrollingMyWorkStarred();
      cy.log("verify my work - starred double flipper view scrolling");
      scrolling.verifyScrollingMyWorkStarredDoubleFlipperView();
      cy.log("verify my work - starred thumbnail view scrolling");
      scrolling.verifyScrollingMyWorkThumbnailView();
    });
    it('verify scrolling in student workspaces', () => {
      beforeTest(queryParams.sas1_1);
      cy.log("verify student workspaces");
      cy.openTopTab("student-work");
      cy.wait(20000);
      
      cy.log('verify scrolling for individual student workspace 4-up view');
      scrolling.verifyScrollingStudentWorkspaces4upView();
      cy.log('verify scrolling for individual student workspace');
      cy.get('.four-up .north-east .member').should('contain', "S3").click();
      scrolling.verifyScrollingStudentWorkspacesExpandedView();
    });
    it('verify scrolling in class work', () => {
      beforeTest(queryParams.sas1_1);
      cy.wait(20000);
      cy.log("verify class work - workspaces");
      cy.openTopTab("class-work");
      cy.wait(2000);
      cy.openSection("class-work", "workspaces");
      cy.wait(20000);
      scrolling.verifyScrollingClassWork();

      cy.log("verify class work - starred");
      cy.openTopTab("class-work");
      cy.wait(2000);
      cy.openSection("class-work", "starred");
      cy.wait(10000);

      cy.log("verify class work - starred single flipper view scrolling");
      scrolling.verifyScrollingClassWorkStarred();
      cy.log("verify class work - starred double flipper view scrolling");
      scrolling.verifyScrollingClassWorkStarredDoubleFlipperView();
      cy.log("verify class work - starred thumbnail view scrolling");
      scrolling.verifyScrollingThumbnailView();
    });
  });
})
