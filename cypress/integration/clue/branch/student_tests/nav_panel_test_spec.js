import RightNav from '../../../../support/elements/common/RightNav';
import Canvas from '../../../../support/elements/common/Canvas';
import ClueCanvas from '../../../../support/elements/clue/cCanvas';

const rightNav = new RightNav;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;
const problemSubTabTitles = ['Introduction', 'Initial Challenge', 'What If', 'Now What'];


describe('Test nav panel tabs', function () {
  let copyDocumentTitle = 'copy Investigation';

  before(function () {
    const baseUrl = `${Cypress.config("baseUrl")}`;
    const queryParams = `${Cypress.config("queryParams")}`;
    cy.clearQAData('all');

    cy.visit(baseUrl + queryParams);
    cy.waitForSpinner();
    clueCanvas.getInvestigationCanvasTitle().text().as('title');
  });
  describe("Investigation Tab tests", function () {
    describe("Problem tabs", function () {
      it('verify tab names are visible', () => {
        cy.openTab("problems");
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
        // cy.openSection('class-work','published');
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
        cy.openTab('my-work');
        cy.openSection("my-work", "workspaces");
        rightNav.starCanvasItem('my-work', 'workspaces', copyDocumentTitle);
      });
      it('verify starred document star is highlighted', function () {
        rightNav.getCanvasStarIcon('my-work', 'workspaces', copyDocumentTitle).should('have.class', 'starred');
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
      cy.openTab('class-work');
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

after(function () {
  cy.clearQAData('all');
});
