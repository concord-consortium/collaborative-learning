import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
// import PrimaryWorkspace from "../../../../support/elements/common/PrimaryWorkspace";
import ResourcesPanel from "../../../../support/elements/clue/ResourcesPanel";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";


let dashboard = new TeacherDashboard();
// let primaryWorkspace = new PrimaryWorkspace();
let resourcesPanel = new ResourcesPanel();
let clueCanvas = new ClueCanvas;

describe.skip('verify document curation', function() {//adding a star to a student document
    before(function() {
        const queryParams = "?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6";
        cy.clearQAData('all');
    
        cy.visit(queryParams);
        cy.waitForLoad();
        dashboard.switchView("Workspace & Resources");
        cy.wait(2000);
        clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle');
    });
        
    let studentDoc = "Student 5: SAS 2.1 Drawing Wumps";

    it('verify starring a student published investigation',function(){
        cy.openResourceTab();
        cy.openTopTab('class-work');
        cy.openSection('class-work','workspaces');
        resourcesPanel.starCanvasItem('class-work','workspaces',studentDoc);
        resourcesPanel.getCanvasStarIcon('class-work','workspaces',studentDoc).should('have.class','starred');
        //make sure only one canvas is starred,
        // but length 2 because there is one in published section and one in Starred section
        cy.get('.icon-star.starred').should('have.length',2);
    });
    it('verify starred document has a star in the dashboard', function(){
        dashboard.switchView('Dashboard');
        dashboard.switchWorkView('Published');
        dashboard.getGroup(1).find('.four-up-overlay .icon-star').should('have.class', 'starred');
    });
    it('verify unstar in dashboard unstars in workspace', function(){
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
