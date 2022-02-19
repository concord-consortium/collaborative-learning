// import PrimaryWorkspace from '../../../../support/elements/common/PrimaryWorkspace';
import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";

// const primaryWorkspace = new PrimaryWorkspace;
const resourcesPanel = new ResourcesPanel;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const problemSubTabTitles = ['Introduction', 'Initial Challenge', 'What If', 'Now What'];

before(()=>{
      cy.clearQAData('all');
});

describe('Test nav panel tabs', function () {
  let copyDocumentTitle = 'copy Investigation';

  before(function () {
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(queryParams);
    cy.waitForLoad();
    clueCanvas.getInvestigationCanvasTitle().text().as('title');
  });
  describe("Investigation Tab tests", function () {
    describe("Problem tabs", function () {
      it('verify tab names are visible', () => {
        cy.get(".collapsed-resources-tab.my-work").click();
        cy.openTopTab("problems");
        cy.get(".problem-tabs .tab-list .prob-tab").each(($tab, index, $tabList) => {
          expect($tab.text()).to.contain(problemSubTabTitles[index]);
        });
      });
    });
  });
  describe('My Work tab tests', function () {
    describe('Investigation section', function () {
      it('verify that a problem workspace thumbnail is visible in the My Work/Workspaces nav panel', function () {
        cy.openTopTab('my-work');
        cy.openSection('my-work', 'workspaces');
        cy.getCanvasItemTitle('workspaces').contains(this.title).should('exist');
        // cy.closeTabs();
      });
      it('verify publish Investigation', function () {
        canvas.publishCanvas("investigation");
        cy.openTopTab('class-work');
        cy.getCanvasItemTitle('problem-workspaces').should('contain', this.title);
      });
      it('verify make a copy of a canvas', function () {
        canvas.copyDocument(copyDocumentTitle);
        canvas.getPersonalDocTitle().find('span').text().should('contain', copyDocumentTitle);
      });
      it('verify copied investigation appears in the workspaces section', function () {
        cy.openTopTab("my-work");
        cy.getCanvasItemTitle('workspaces').contains(copyDocumentTitle).should('be.visible');
      });
      it('verify publish of personal workspace', function () {
        canvas.publishCanvas("personal");
        cy.openTopTab('class-work');
        cy.openSection('class-work', 'extra-workspaces');
        cy.getCanvasItemTitle('extra-workspaces').should('contain', copyDocumentTitle);
      });
      it('verify delete document reverts nav-tab panel to show thumbnails', function () {
        const deleteDocument = "Delete me";
        canvas.copyDocument(deleteDocument);
        cy.openTopTab('my-work');
        cy.wait(1000);
        cy.getCanvasItemTitle('workspaces').should('contain', deleteDocument);
        cy.openDocumentWithTitle('my-work', 'workspaces', copyDocumentTitle);
        cy.openDocumentWithTitle('my-work', 'workspaces', deleteDocument);
        canvas.deleteDocument();
        cy.getCanvasItemTitle('workspaces').should('not.contain', deleteDocument);
      });
    });
    describe('Workspaces section', function () {
      it('verify open the correct canvas selected from Investigations section', function () {
        cy.openTopTab("my-work");
        cy.openDocumentWithTitle('my-work', 'workspaces', this.title);
        clueCanvas.getInvestigationCanvasTitle().should('contain', this.title);
      });
      it('verify open the correct canvas selected from Extra Workspace section', function () {
        cy.openTopTab("my-work");
        cy.openDocumentWithTitle('my-work', 'workspaces', copyDocumentTitle);
        canvas.getPersonalDocTitle().should('contain', copyDocumentTitle);
      });
      after(()=>{
        cy.closeTabs();
      });
    });
    describe('Starred section', function () {
      before(() => {
        cy.get(".collapsed-resources-tab.my-work").click();
        cy.openTopTab('my-work');
        cy.openSection("my-work", "workspaces");
        resourcesPanel.starCanvasItem('my-work', 'workspaces', copyDocumentTitle);
      });
      it('verify starred document star is highlighted', function () {
        resourcesPanel.getCanvasStarIcon('my-work', 'workspaces', copyDocumentTitle).should('have.class', 'starred');
      });
      it('verify starred document appears in the Starred section', function () {
        cy.openSection('my-work', 'starred');
        cy.getCanvasItemTitle('starred').contains(copyDocumentTitle).should('exist');
      });
    });
    describe('Learning Log Section', function () {
      it('verify investigation canvas is not listed in Learning Log ', function () { //still need to verify the titles match the titles from opened canvases
        cy.openTopTab('my-work');
        cy.openSection('my-work', 'learning-log');
        cy.getCanvasItemTitle('learning-log').contains(this.title).should('not.exist');
        cy.getCanvasItemTitle('learning-log').should('have.length', 1);
      });
      it('verify user starter learning log canvas exists', function () {
        cy.getCanvasItemTitle('learning-log').contains("My First Learning Log").should('be.visible');
      });
      it('verify open of learning log canvas into main workspace', function () {
        cy.openDocumentWithTitle('my-work', 'learning-log', "My First Learning Log");
        cy.get("[data-test=learning-log-title]").should('contain', "My First Learning Log");
      });
      it('verify Learning Log copy appears in Learning Log section', function () {
        canvas.copyDocument("Learning Log Copy");
        cy.openSection("my-work","learning-log");
        cy.wait(2500);
        cy.getCanvasItemTitle('learning-log').contains("Learning Log Copy").should("be.visible");
      });
      it('verify publish learning log', function () {
        canvas.publishCanvas("personal");
        cy.openTopTab("class-work");
        cy.openSection("class-work", "learning-logs");
        cy.getCanvasItemTitle("learning-logs", "Learning Log Copy");
      });
    });
    after(function () {
      cy.closeTabs(); // clean up
    });
  });

  describe('Class Work tab tests', function () { //uses publish documents from earlier tests
    before(() => {
      cy.get(".collapsed-resources-tab.class-work").click();
      cy.openTopTab('class-work');
    });
    describe('Open correct canvas from correct section', function () {
      it('verify open published canvas from Workspace list', function () { //this assumes there are published work
        cy.openSection("class-work", "extra-workspaces");
        cy.openDocumentThumbnail('extra-workspaces', copyDocumentTitle);
      });
      it('verify open published canvas from Investigations list', function () { //this assumes there are published work
        cy.openSection("class-work", "problem-workspaces");
        cy.openDocumentThumbnail('problem-workspaces', this.title);
      });
      it('will verify that published canvas does not have Edit button', function () {
        cy.get('.edit-button').should("not.exist");
      });
    });
  });
  describe('Supports Tab', function () {
    describe('Test supports area', function () {
      it('verify support tabs', function () {
        cy.openTopTab("supports");
        cy.get(".doc-tab.supports").should("have.length", 2);
      });
    });
  });
});

describe.only('Nav panel tab configs', function () {
  const baseQueryParam = "?appMode=qa&fakeClass=10&fakeUser=student:11&fakeOffering=10&qaGroup=10";
  it('Single Top tab with visible resource tab panel', function () {
    cy.visit(`${baseQueryParam}&unit=example`);
    cy.waitForLoad();
    cy.get(".collapsed-resources-tab.my-work").should('not.exist');
    canvas.openFileMenu();
    cy.get ("[data-test=list-item-icon-open-workspace]").click();
    cy.get(".tab-header-row").should("not.be.visible");
  });
  it('Single Top tab with visible resource tab panel', function () {
    cy.visit(`${baseQueryParam}&unit=example-show-nav-panel`);
    cy.waitForLoad();
    cy.get(".collapsed-resources-tab.my-work").click();
    cy.get(".top-tab").should("have.length", 1);
    cy.get(".document-tabs.my-work .tab-header-row").should("not.be.visible");
    canvas.openFileMenu();
    cy.get ("[data-test=list-item-icon-open-workspace]").click();
    cy.get(".tab-header-row").should("not.be.visible");
  });
  it('Problem Tabs with no sub tabs', function () {
    cy.visit(`${baseQueryParam}&unit=example-no-section-problem-tab`);
    cy.waitForLoad();
    cy.get(".collapsed-resources-tab.my-work").click();
    cy.openTopTab("problems");
    cy.get(".problem-tabs .tab-header-row").should("not.be.visible");
  });
  it('Problem Tabs with no sub tabs', function () {
    const exampleProblemSubTabTitles = ["First Section", "Second Section", "Third Section"];
    const exampleMyWorkSubTabTitles = ["Workspaces", "Starred"];
    const exampleClassWorkSubTabTitles = ["Problem Workspaces", "Extra Workspaces", "Starred"];

    cy.visit(`${baseQueryParam}&unit=example-config-subtabs`);
    cy.waitForLoad();
    cy.get(".collapsed-resources-tab.my-work").click();
    cy.openTopTab("problems");
    cy.get(".problem-tabs .tab-list .prob-tab").each(($tab, index, $tabList) => {
      expect($tabList).to.have.lengthOf(3);
      expect($tab.text()).to.contain(exampleProblemSubTabTitles[index]);
    });
    cy.openTopTab("my-work");
    cy.get(".document-tabs .tab-list .doc-tab.my-work").each(($tab, index, $tabList) => {
      expect($tabList).to.have.lengthOf(2);
      expect($tab.text()).to.contain(exampleMyWorkSubTabTitles[index]);
    });
    cy.openTopTab("class-work");
    cy.get(".document-tabs .tab-list .doc-tab.class-work").each(($tab, index, $tabList) => {
      expect($tabList).to.have.lengthOf(3);
      expect($tab.text()).to.contain(exampleClassWorkSubTabTitles[index]);
    });
  });
});

after(function () {
  cy.clearQAData('all');
});
