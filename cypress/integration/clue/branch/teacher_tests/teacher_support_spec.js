import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import ClueRightNav from "../../../../support/elements/clue/cRightNav";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";


    let dashboard = new TeacherDashboard();
    let rightNav = new RightNav();
    let clueCanvas = new ClueCanvas;
    let clueRightNav = new ClueRightNav;
    let tableToolTile = new TableToolTile;

    const baseUrl = `${Cypress.config("baseUrl")}`;

    const title = "Drawing Wumps";


    before(function() {
        const queryParams = `${Cypress.config("teacherQueryParams")}`;
        cy.clearQAData('all');
    
        cy.visit(baseUrl+queryParams);
        cy.waitForSpinner();
        dashboard.switchView("Workspace")
        cy.wait(2000)
        // clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle')               
    })

    describe.skip('verify supports functionality', function() {//may need to break down even further between class, group, and student
        it('will verify publish of support appears in Support>Teacher Workspace',function(){
            // let title = ((this.investigationTitle).split('2.1')[1]).trim()

            clueCanvas.addTile('table');
            clueCanvas.publishSupportDoc();
            rightNav.openRightNavTab('supports');
            rightNav.openSection('supports','teacher-supports');
            rightNav.getCanvasItemTitle('supports','teacher-supports').should('contain',title)
        })
    }) 

    describe.skip("test visibility of teacher supports in student's workspace", function() {
            // let title = ((this.investigationTitle).split('2.1')[1]).trim()
            it('verify badge on Support Tab',function(){
                const queryParams = `${Cypress.config("queryParams")}`;
            
                cy.visit(baseUrl+queryParams);
                cy.waitForSpinner();
                clueRightNav.getSupportBadge().should('be.visible')
            })
            it('verify teacher support is visible in student rightnav', function() {
                rightNav.openRightNavTab('supports');
                rightNav.openSection('supports', 'teacher-supports');
                rightNav.getCanvasItemTitle('supports', 'teacher-supports', title).should('be.visible')
            })
            it('verify supports open in 2up view righthand workspace', () => {
                rightNav.openCanvasItem('supports', 'teacher-supports', title);
                cy.wait(1000)
                clueCanvas.getRightSideInvestigationTitle().should('contain',title)
                clueCanvas.getRightSideDocumentContent().find(tableToolTile.tableTool()).should('be.visible')
            })
    })

// after(function(){
//         const baseUrl = `${Cypress.config("baseUrl")}`;
//         const queryParams = `${Cypress.config("teacherQueryParams")}`;
    
//         cy.visit(baseUrl+queryParams);
//         cy.waitForSpinner();

//         dashboard.switchView('Workspace');
//         cy.wait(2000);
//         clueCanvas.deleteTile('table');

        cy.visit(baseUrl+queryParams);
        cy.waitForSpinner();

        dashboard.switchView('Workspace');
        cy.wait(2000);
        clueCanvas.deleteTile('table');

        rightNav.openRightNavTab('supports');
        rightNav.openSection('supports','teacher-supports');
        clueRightNav.deleteTeacherSupport('supports','teacher-supports',title)

        cy.clearQAData('all');

})
   