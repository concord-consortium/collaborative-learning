import TeacherDashboard from "../../../support/elements/common/TeacherDashboard";
import ResourcesPanel from "../../../support/elements/common/ResourcesPanel";
import ClueCanvas from "../../../support/elements/common/cCanvas";


let dashboard = new TeacherDashboard();
// let primaryWorkspace = new PrimaryWorkspace();
let resourcesPanel = new ResourcesPanel();
let clueCanvas = new ClueCanvas;

const defaultProblemDocTitle = "QA 1.1 Solving a Mystery with Proportional Reasoning";

function beforeTest() {
    const queryParams = `${Cypress.config("clueTestqaUnitTeacher6")}`;
    cy.clearQAData('all');
    cy.visit(queryParams);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(5000);
    cy.openDocumentWithTitle('my-work', 'workspaces', defaultProblemDocTitle);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
}

describe('verify document curation', function() {//adding a star to a student document

    let studentDoc = "Student 5: QA 1.1 Solving a Mystery with Proportional Reasoning";
    it('verify starring and unstar',function(){
        beforeTest();
        cy.log('verify starring a student published investigation');
        cy.openTopTab('class-work');
        cy.openSection('class-work','workspaces');
        resourcesPanel.starCanvasItem('class-work','workspaces',studentDoc);
        resourcesPanel.getCanvasStarIcon('class-work','workspaces',studentDoc).should('have.class','starred');
        //make sure only one canvas is starred,
        //length is one if Starred section has not been loaded.
        //length becomes 2 when the Starred section is exposed.
        cy.get('.icon-star.starred').should('have.length.be.at.least', 1);

        cy.log('verify starred document has a star in the dashboard');
        dashboard.switchView('Dashboard');
        dashboard.switchWorkView('Published');
        dashboard.getGroup(1).find('.four-up .icon-star').should('have.class', 'starred');

        cy.log('verify unstar in dashboard unstars in workspace');
        dashboard.clearAllStarsFromPublishedWork();
        cy.wait(1000);
        dashboard.switchView('Workspace & Resources');
        cy.openTopTab('class-work');
        cy.openSection('class-work','bookmarks');
        cy.getCanvasItemTitle('class-work', 'bookmarks', studentDoc).should('not.exist');
        cy.openSection('class-work','workspaces');
        resourcesPanel.getCanvasStarIcon('class-work','workspaces',studentDoc).should('not.have.class','starred');
    });
});
