import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import RightNav from "../../../../support/elements/common/RightNav";
import Header from "../../../../support/elements/common/Header";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";
import TeacherWorkspace from "../../../../support/elements/clue/TeacherWorkspace";
import Dialog from "../../../../support/elements/common/Dialog";

let dashboard = new TeacherDashboard();
let rightNav = new RightNav();
let header = new Header;
let clueCanvas = new ClueCanvas
let workspace = new TeacherWorkspace
let dialog = new Dialog

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

const baseUrl = `${Cypress.config("baseUrl")}`;

context("Teacher Space", () => {

    const clueTeacher = {
        username: "clueteachertest",
        password: "password"
    }

    before(() => {
        const queryParams = `${Cypress.config("teacherQueryParams")}`;
    
        cy.visit(baseUrl+queryParams);
        cy.waitForSpinner();

        dashboard.switchWorkView('Published');
        dashboard.clearAllStarsFromPublishedWork();
        dashboard.switchWorkView('Current')
    })

    beforeEach(() => {
        cy.fixture("teacher-dash-data-CLUE-test.json").as("clueData")
    })

    context('Teacher Dashboard View', () => {
        describe('UI visibility', () => {
            it('verify header elements', () => {
                cy.get('@clueData').then((clueData) => {
                    let tempClass = clueData.classes[0]

                    // Check Investigation Name visibility
                    dashboard.getInvestigationTitle().should('be.visible').and('contain', clueData.investigationTitle)
                    // Check problem list  UI and visibility
                    dashboard.getProblemList().should('not.have.attr','open')
                    dashboard.getProblemDropdown().should('be.visible').click({ force: true })
                    dashboard.getProblemList().should('exist').and('have.attr','open')
                    dashboard.getProblemList().find('.Menuitem').should('have.length', tempClass.problemTotal)
                    dashboard.getProblemDropdown().click({ force: true })
                    dashboard.getProblemList().should('not.have.attr','open')
                    // Check class list UI and visibility
                    dashboard.getClassList().should('not.have.attr','open')
                    dashboard.getClassDropdown().should('contain',clueData.teacherName).and('contain',tempClass.className)
                    dashboard.getClassDropdown().should('be.visible').click({ force: true })
                    dashboard.getClassList().should('exist').and('have.attr', 'open') 
                    // dashboard.getClassList().find('.Menuitem').should('have.length', clueData.classes.length) // FIX THIS - currently shows all classes including inactive classes. Should only show active classes. Story in PT.
                    dashboard.getClassDropdown().click({ force: true })
                    dashboard.getClassList().should('not.have.attr','open')
                    // Check Dashboard and Workspace toggle default
                    dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected')
                    dashboard.getViewToggle('Workspace').should('be.visible').and ('not.have.class', 'selected')
                    // Check Teacher Username visibility and content
                    // header.getUserName().should('be.visible').and('contain', clueData.teacherName)
                })
            })
            it('verifies six pack and group names', () => { //check this test again
                cy.get('@clueData').then((clueData) => {
                    let tempGroupIndex = 0
                    let groups = clueData.classes[0].problems[0].groups
                    let group = groups[tempGroupIndex]

                    // Check for group title
                    dashboard.getSixPackView().should('exist').and('be.visible')
                    dashboard.getGroupName().eq(group.groupIndex).should('contain', group.groupName)
                    // Check for group length (4Up Count)
                    dashboard.getSixPackView().then(() => {
                        dashboard.getFourUpViews().should('have.length', 6)
                    })
                })
            })
            it('verify current and published toggle button appear and work', () => {
                dashboard.getWorkToggle("Current").should('have.class', 'selected').and('be.visible')
                dashboard.getWorkToggle("Published").should('not.have.class', 'selected').and('be.visible').click({ force: true })
                dashboard.getWorkToggle("Current").should('not.have.class', 'selected')
                dashboard.getWorkToggle("Published").should('have.class', 'selected')
                dashboard.getWorkToggle("Current").click({ force: true })
            })
            describe('Progress area',()=>{
                let sectionIDArr = ["IN","IC","WI","NW"]
                it('displays progress icons', () => {
                    sectionIDArr.forEach((section)=>{
                        dashboard.getSectionProgressIcons(section).should('be.visible')
                    })
                })
                it('displays progress numbers', ()=>{
                    sectionIDArr.forEach((section)=>{
                        dashboard.getTotalProgressNumber(section).should('be.visible')
                        dashboard.getCurrentProgressNumber(section).should('be.visible')
                    })
                })
            })
            it('verify six-pack page toggle',()=>{ //only passes if there are more 6 groups in the class
                dashboard.getPreviousPageButton().should('be.visible').and('have.class','disabled')
                dashboard.getNextPageButton().should('be.visible').and('not.have.class', 'disabled')
            })
        })
        describe('Header element functionality', () => {
            it('verify switching problems changes six pack content and problem title', () => {
                cy.get('@clueData').then((clueData) => {
                    let problems = clueData.classes[0].problems
                    let initProblemIndex = 0
                    let tempProblemIndex = 1

                    dashboard.getProblemDropdown().text().should('not.contain', problems[tempProblemIndex].problemTitle)
                    dashboard.getGroups().should('have.length',6)
                    dashboard.getProblemDropdown().click({ force: true }).then(() => {
                        dashboard.getProblemList().should('have.attr','open')
                        dashboard.getProblemList().find('.Menuitem').contains(problems[tempProblemIndex].problemTitle).click({ force: true })
                        // This differs from production test. Production tests for actual problem switching
                    dialog.getDialogTitle().should('contain','Problem not currently assigned');
                    dialog.getDialogOKButton().click();
                    })
                    dashboard.getProblemDropdown().should('contain', problems[initProblemIndex].problemTitle)
                    dashboard.getGroups().should('have.length',6)

                    //Not testing in branch since switch can't be done -- switch back to original problem for later test
                    // dashboard.getProblemDropdown().click({force:true})
                    // dashboard.getProblemList().find('.Menuitem').contains(problems[initProblemIndex].problemTitle).click({ force: true })
                    // // cy.wait(1000)
                    // cy.waitForSpinner()
                })
            })
            it('verify dashboard/workspace switch changes workspace view', () => {
                dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected')
                clueCanvas.getSingleWorkspace().should('not.be.visible')
                dashboard.getViewToggle('Workspace').should('be.visible').and('not.have.class', 'selected')
                dashboard.getViewToggle('Workspace').click({ force: true })
                dashboard.getViewToggle("Workspace").should('have.class', 'selected')
                clueCanvas.getSingleWorkspace().should('be.visible')
                dashboard.getViewToggle("Dashboard").click({ force: true })
                dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected')
            })
            it('verify selected class is shown in class dropdown', () => {
                cy.get('@clueData').then((clueData) => {
                    let initialClassIndex = 0
                    let tempClass = clueData.classes[initialClassIndex]

                    dashboard.getClassDropdown().should('contain', tempClass.className).and('be.visible')
                })
            })
            it.skip('verify switching classes changes six pack content', () => {
                cy.get('@clueData').then((clueData) => {
                    const initClassIndex = 0
                    const tempClassIndex = 1
                    let initClass = clueData.classes[initClassIndex]
                    let tempClass = clueData.classes[tempClassIndex]
                    let className = tempClass.className
                    let initClassName = initClass.className

                    dashboard.getClassDropdown().should('contain', initClassName)
                    dashboard.getGroups().should('have.length',6)
                    dashboard.getClassDropdown().click({ force: true }).then(() => {
                        dashboard.getClassList().contains(className).click({ force: true })
                        // cy.wait(1000)
                        cy.waitForSpinner()
                    })
                    dashboard.getClassDropdown().should('contain', className)
                    dashboard.getGroups().should('have.length',0)

                    //switch back to original problem for later test
                    dashboard.getClassDropdown().click({force:true})
                    dashboard.getClassList().find('.Menuitem').contains(initClassName).click({ force: true })
                    // cy.wait(1000)
                    cy.waitForSpinner()
                })
            })
        })

        describe('6-pack view functionality - Current Work', () => {
            before(function(){
                dashboard.getProblemDropdown().text().as('problemTitle');
            })
            it('verifies students are in correct groups', () => {
                cy.get('@clueData').then((clueData) => {
                    let groups = clueData.classes[0].problems[0].groups
                    let groupIndex = 0
                    let studentIndex = 0

                    let groupName = groups[groupIndex].groupName
                    let studentID = groups[groupIndex].students[studentIndex].studentID

                    dashboard.getGroupName().eq(groupIndex).should('contain', 'Group ' + groupName)
                    dashboard.getGroups().eq(groupIndex).within(() => {
                        //for (let i = 0; i < groups[tempGroupIndex].students.length; i++) {
                        dashboard.getStudentID().eq(studentIndex).should('contain', studentID)
                        //}
                    })
                })
            })
            it('verify each canvas in a 4 up view is read only', () => {
                cy.get('@clueData').then((clueData) => {
                    let tempGroupIndex = 0
                    let tempGroup = clueData.classes[0].problems[0].groups[tempGroupIndex]
                    dashboard.verifyWorkForGroupReadOnly(tempGroup)
                    cy.wait(1000)
                })
            })
            it('verify message button opens message dialog to group',function(){
                cy.get('@clueData').then((clueData) => {
                    let groups = clueData.classes[0].problems[0].groups
                    dashboard.sendGroupNote(2,"This is a note to Group 2");
                })
            })
            it('verify clicking support button opens two up with group open', function() {
                cy.get('@clueData').then((clueData) => {
                    let groups = clueData.classes[0].problems[0].groups
                    dashboard.getDashboardSupportButton().eq(0).click();
                    clueCanvas.getLeftSideWorkspace().should('be.visible')
                    clueCanvas.getLeftSideWorkspaceTitle().should('contain',this.problemTitle);
                    clueCanvas.getRightSideWorkspace().should('be.visible')
                    clueCanvas.getRightSideInvestigationTitle().should('have.class', 'group-title')
                    clueCanvas.getRightSideWorkspace().within(()=>{
                        workspace.getGroupNumberButton().should('be.visible').and('have.length',groups.length)
                    })
                })
                dashboard.switchView('Dashboard') //switch back to continue tests
            })
            it('clicking expand group button will open that single group in teacher workspace', () => {
                cy.get('@clueData').then((clueData) => {
                    let groups = clueData.classes[0].problems[0].groups
                    dashboard.getExpandGroupViewButton().eq(1).click();//hard coding clicking the first icon
                    clueCanvas.getSingleWorkspace().should('be.visible');
                    clueCanvas.getFourUpView().should('be.visible');
                    clueCanvas.getInvestigationCanvasTitle().should('have.class', 'group-title')
                    clueCanvas.getSingleWorkspace().within(()=>{
                        workspace.getGroupNumberButton().should('be.visible').and('have.length',groups.length)
                    })
                })

                dashboard.switchView('Dashboard') //switch back to continue tests
            })
            it('verify clicking a students canvas in 4 up view zooms into students canvas with student name', () => { 
                cy.get('@clueData').then((clueData) => {
                    let groupIndex = 0
                    let studentIndex = 0

                    let group = clueData.classes[0].problems[0].groups[groupIndex]
                    let student = group.students[studentIndex]

                    dashboard.getGroups().eq(group.groupIndex).within(() => {
                        dashboard.getStudentCanvas(student.quadrant).click({ force: true })
                    })

                })
            })
            it('verifies section tool progress', () => { //currently hard coded since we are using a static test class
                // total = 30, IN = 30, IC = 9, WI = 10, NW = 7
                let progress = {"total":"30",
                                 "IN":"30",
                                 "IC":"9",
                                 "WI":"10",
                                 "NW":"7"
                                }; 
                dashboard.getTotalProgressNumber("IN").should('contain',progress["total"])
                dashboard.getTotalProgressNumber("IC").should('contain',progress["total"])
                dashboard.getTotalProgressNumber("WI").should('contain',progress["total"])
                dashboard.getTotalProgressNumber("NW").should('contain',progress["total"])
                dashboard.getCurrentProgressNumber("IN").should('contain',progress["IN"])
                dashboard.getCurrentProgressNumber("IC").should('contain',progress["IC"])
                dashboard.getCurrentProgressNumber("WI").should('contain',progress["WI"])
                dashboard.getCurrentProgressNumber("NW").should('contain',progress["NW"])


            })
            it('can switch pages', () => {
                // Use when clue class has LESS than 6 groups
                // dashboard.getPreviousPageButton().should('exist').and('not.be.visible').and('have.class', 'disabled')
                // dashboard.getNextPageButton().should('exist').and('not.be.visible').and('have.class', 'disabled')

                // Use when clue class has MORE than 6 groups
                dashboard.getGroups().should('have.length',6)
                dashboard.getPreviousPageButton().should('have.class', 'disabled').and('be.visible')
                dashboard.getNextPageButton().should('not.have.class', 'disabled').and('be.visible')
                dashboard.getNextPageButton().click({force:true});
                dashboard.getGroups().should('have.length',3)
                dashboard.getNextPageButton().should('have.class', 'disabled')
                dashboard.getPreviousPageButton().should('not.have.class', 'disabled')
                dashboard.getPreviousPageButton().click({force:true})
                dashboard.getPreviousPageButton().should('have.class', 'disabled')
                dashboard.getGroups().should('have.length',6)
                dashboard.getNextPageButton().should('not.have.class', 'disabled')
            })
        })
        describe('6-pack view functionality - Published Work', () => {
            it('switches to published work tab and checks UI options', () => {
                // not working - nocan't get to the right canvas
                let classIndex = 0
                let problemIndex = 0
                let groupIndex = 0
                let group

                dashboard.switchWorkView("Published");
                cy.get('@clueData').then((clueData) => {
                    group = clueData.classes[classIndex].problems[problemIndex].groups[groupIndex]
                    cy.wait(3000) //need to wait for canvases to load
                    dashboard.verifyPublishStatus(group)
                })

            })
            it('select stars for students', () => { // Want this to be for all students once it passes
                let classIndex = 0
                let problemIndex = 0
                let groups

                cy.get('@clueData').then((clueData) => {
                    groups = clueData.classes[classIndex].problems[problemIndex].groups
                    dashboard.clearAllStarsFromPublishedWork()
                    dashboard.starPublishedWork(groups)
                })
            })

            it('removes all stars from student published work', () => { 
                dashboard.getStarPublishIcon().should('have.class', 'starred')
                dashboard.getStarPublishIcon().click({ force: true, multiple: true })
                dashboard.getStarPublishIcon().should('not.have.class', 'starred')
            })
        })
        describe('6-pack view live updates', () => {
            it('verify 4up views in 6 pack are updated as student makes changes', () => {
                /**
                 * Check for current existing element in student canvas
                 * Visit student link
                 * Do some work as student
                 * Verify that there were changes/new elements
                 */
            })
        })
    })
})
