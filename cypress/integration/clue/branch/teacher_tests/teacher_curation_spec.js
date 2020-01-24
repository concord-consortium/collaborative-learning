import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import Canvas from "../../../../support/elements/common/Canvas";
import TableToolTile from "../../../../support/elements/clue/TableToolTile";
import DrawToolTile from "../../../../support/elements/clue/DrawToolTile";
import ClueRightNav from "../../../../support/elements/clue/cRightNav";
import TextToolTile from "../../../../support/elements/clue/TextToolTile";


    let dashboard = new TeacherDashboard();
    let rightNav = new RightNav();
    let clueCanvas = new ClueCanvas;

    const baseUrl = `${Cypress.config("baseUrl")}`;

    before(function() {
        const queryParams = `${Cypress.config("teacherQueryParams")}`;
    
        cy.visit(baseUrl+queryParams);
        cy.waitForSpinner();
        dashboard.switchView("Workspace")
        cy.wait(2000)
        clueCanvas.getInvestigationCanvasTitle().text().as('investigationTitle')               
    })
    
    describe('verify document curation', function() {//adding a star to a student document
        let studentDoc = "Student 5: 2.1 Drawing Wumps"

        it('verify starring a student published investigation',function(){
            rightNav.openRightNavTab('class-work')
            rightNav.openSection('class-work','published')
            rightNav.starCanvasItem('class-work','published',studentDoc)
            rightNav.getCanvasStarIcon('class-work','published',studentDoc).should('have.class','starred')
            //make sure only one canvas is starred, 
            // but length 2 because there is one in published section and one in Starred section
            cy.get('.icon-star.starred').should('have.length',2)

        })
        it('verify starred document appears in Starred section in right nav',function(){
            rightNav.closeSection('class-work','published')
            rightNav.openSection('class-work','starred')
            cy.wait(1000)
            rightNav.getCanvasItemTitle('class-work','starred',studentDoc)
        })
        it('verify starred document has a star in the dashboard', function(){
            dashboard.switchView('Dashboard');
            dashboard.switchWorkView('Published');
            dashboard.getGroup(1).find('.four-up-overlay .icon-star').should('have.class', 'starred')
        })
        it('verify unstar in dashboard unstars in workspace', function(){
            dashboard.clearAllStarsFromPublishedWork()
            cy.wait(1000)
            dashboard.switchView('Workspace')
            rightNav.openRightNavTab('class-work')
            rightNav.openSection('class-work','starred')
            rightNav.getCanvasItemTitle('class-work', 'starred', studentDoc).should('not.exist')
            rightNav.openSection('class-work','published')
            rightNav.getCanvasStarIcon('class-work','published',studentDoc).should('not.have.class','starred')
        })
    })
