import Canvas from '../../../support/elements/common/Canvas';
import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";

// const primaryWorkspace = new PrimaryWorkspace;
const resourcesPanel = new ResourcesPanel;
const canvas = new Canvas;
let dashboard = new TeacherDashboard();
let title = "1.1 Unit Toolbar Configuration";

const queryParams1 = `${Cypress.config("qaConfigSubtabsUnitStudent5")}`;
const queryParams2 = `${Cypress.config("qaConfigSubtabsUnitTeacher1")}`;

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
}

context('Bookmarks', function () {
  it('Test bookmarks for student', function () {
    beforeTest(queryParams1);
    let copyDocumentTitle = 'copy Investigation';

    cy.log('verify bookmarked problem document is visible in the My Work/Bookmarks panel');
    cy.openTopTab('my-work');
    cy.openSection('my-work', 'workspaces');
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').contains(title).should('exist');
    resourcesPanel.starCanvasItem('my-work', 'workspaces', title);
    resourcesPanel.getCanvasStarIcon('my-work', 'workspaces', title).should('have.class', 'starred');
    cy.openSection('my-work', 'bookmarks');
    resourcesPanel.getCanvasItemTitle('my-work', 'bookmarks').contains(title).should('exist');

    cy.log('verify publish problem document');
    canvas.publishCanvas("investigation");
    cy.openTopTab('class-work');
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', title);

    cy.log('verify bookmarked personal document is visible in the My Work/Bookmarks panel');
    canvas.copyDocument(copyDocumentTitle);
    canvas.getPersonalDocTitle().find('span').text().should('contain', copyDocumentTitle);
    cy.openTopTab('my-work');
    cy.openSection('my-work', 'workspaces');
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').contains(copyDocumentTitle).should('be.visible');
    resourcesPanel.starCanvasItem('my-work', 'workspaces', copyDocumentTitle);
    resourcesPanel.getCanvasStarIcon('my-work', 'workspaces', copyDocumentTitle).should('have.class', 'starred');
    cy.openSection('my-work', 'bookmarks');
    resourcesPanel.getCanvasItemTitle('my-work', 'bookmarks').contains(copyDocumentTitle).should('exist');
    resourcesPanel.getCanvasItemTitle('my-work', 'bookmarks').contains(title).should('exist');

    cy.log('verify publish personal document');
    canvas.publishCanvas("personal");
    resourcesPanel.openTopTab('class-work');
    cy.openSection('class-work', "workspaces");
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', copyDocumentTitle);

    cy.log('verify published bookmarked problem document is visible in the Class Work/Bookmarks panel');
    cy.openTopTab('class-work');
    cy.openSection('class-work', 'workspaces');
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').contains(title).should('exist');

    // These below lines of code fail due to PT bug
    // TODO: Once it is resolved, these can be commented
    // Bookmarks and Delete buttons overlap causing failure to bookmark a published document

    // resourcesPanel.starCanvasItem('class-work', 'workspaces', title);
    // resourcesPanel.getCanvasStarIcon('class-work', 'workspaces', title).should('have.class', 'starred');
    // cy.openSection('class-work', 'bookmarks');
    // resourcesPanel.getCanvasItemTitle('class-work', 'bookmarks').contains(title).should('exist');

    // cy.log('verify published bookmarked personal document is visible in the Class Work/Bookmarks panel');
    // cy.openTopTab('class-work');
    // cy.openSection('class-work', 'workspaces');
    // resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').contains(copyDocumentTitle).should('exist');
    // resourcesPanel.starCanvasItem('class-work', 'workspaces', copyDocumentTitle);
    // resourcesPanel.getCanvasStarIcon('class-work', 'workspaces', copyDocumentTitle).should('have.class', 'starred');
    // cy.openSection('class-work', 'bookmarks');
    // resourcesPanel.getCanvasItemTitle('class-work', 'bookmarks').contains(copyDocumentTitle).should('exist');
  })
  it('Test bookmarks for teacher', function () {
    beforeTest(queryParams1);
    let copyDocumentTitle = 'copy Investigation';

    cy.log('verify problem document is visible in the My Work/Bookmarks panel');
    cy.openTopTab('my-work');
    cy.openSection('my-work', 'workspaces');
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').contains(title).should('exist');

    cy.log('verify publish problem document');
    canvas.publishCanvas("investigation");
    cy.openTopTab('class-work');
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', title);

    cy.log('verify personal document is visible in the My Work/Bookmarks panel');
    canvas.copyDocument(copyDocumentTitle);
    canvas.getPersonalDocTitle().find('span').text().should('contain', copyDocumentTitle);
    cy.openTopTab('my-work');
    cy.openSection('my-work', 'workspaces');
    resourcesPanel.getCanvasItemTitle('my-work', 'workspaces').contains(copyDocumentTitle).should('be.visible');

    cy.log('verify publish personal document');
    canvas.publishCanvas("personal");
    resourcesPanel.openTopTab('class-work');
    cy.openSection('class-work', "workspaces");
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').should('contain', copyDocumentTitle);

    cy.visit(queryParams2);
    cy.waitForLoad();
    dashboard.switchView("Dashboard");
    dashboard.switchWorkView('Published');
    dashboard.getStarPublishIcon().should('not.have.class', 'starred');
    dashboard.getStarPublishIcon().click({ force: true, multiple: true });
    dashboard.getStarPublishIcon().should('have.class', 'starred');
    dashboard.switchView('Workspace & Resources');

    cy.log('verify published bookmarked problem document is visible in the Class Work/Bookmarks panel');
    cy.openTopTab('class-work');
    cy.openSection('class-work', 'workspaces');
    resourcesPanel.getCanvasItemTitle('class-work', 'workspaces').contains(title).should('exist');
    resourcesPanel.getCanvasStarIcon('class-work', 'workspaces', title).should('have.class', 'starred');
    cy.openSection('class-work', 'bookmarks');
    resourcesPanel.getCanvasItemTitle('class-work', 'bookmarks').contains(title).should('exist');
  })
})
