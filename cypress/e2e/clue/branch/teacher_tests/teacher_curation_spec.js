import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
// import PrimaryWorkspace from "../../../../support/elements/common/PrimaryWorkspace";
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";


let dashboard = new TeacherDashboard();
// let primaryWorkspace = new PrimaryWorkspace();
let resourcesPanel = new ResourcesPanel();
let clueCanvas = new ClueCanvas;

const queryParams = "?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6";

function beforeTest(params) {
    cy.clearQAData('all');
    cy.visit(params);
    cy.waitForLoad();
    dashboard.switchView("Workspace & Resources");
    cy.wait(5000);
    clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
}

describe('verify document curation', function() {//adding a star to a student document

    let studentDoc = "Student 5: SAS 2.1 Drawing Wumps";

    it('verify starring and unstar',function(){
        beforeTest(queryParams);
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
        cy.openSection('class-work','starred');
        cy.getCanvasItemTitle('class-work', 'starred', studentDoc).should('not.exist');
        cy.openSection('class-work','workspaces');
        resourcesPanel.getCanvasStarIcon('class-work','workspaces',studentDoc).should('not.have.class','starred');
    });
});
