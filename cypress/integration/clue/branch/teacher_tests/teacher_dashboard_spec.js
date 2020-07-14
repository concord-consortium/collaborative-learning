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

const baseUrl = `${Cypress.config("baseUrl")}`;


    before(() => {
        const queryParams = "?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6&unit=sas"
    
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
                    // Check Dashboard and Workspace toggle default
                    dashboard.getViewToggle('Dashboard').should('be.visible').and('have.class', 'selected')
                    dashboard.getViewToggle('Workspace').should('be.visible').and ('not.have.class', 'selected')
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
                        dashboard.getStudentID(studentIndex).should('contain', studentID)
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
                        dashboard.getStudentOverlay(student.quadrant).click({ force: true })
                        dashboard.getZoomedStudentID(student.index).should('contain', 'Student 1')
                        dashboard.closeStudentCanvas(student.quadrant) //return to original state
                    })

                })
            })
            it('verify message button opens message dialog to student',function(){
                let group = 1,
                studentName = "Student 1",
                quadrant = ".north-west",
                textToStudent = "This is a note to clue testing1"

                cy.get('@clueData').then((clueData) => {
                    dashboard.sendStudentNote(group-1,studentName,quadrant,textToStudent);
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
