import Header from '../support/xelements/Header';
import RightNav from '../support/xelements/RightNav';
import Workspace from '../support/xelements/Workspace';
import TeacherDashboard from '../support/xelements/TeacherDashboard';

let qaClass = 10,
    qaGroup10 = 10,
    problem = 2.3,
    studentArr10=[15], //TODO: setupGroup isn't working as expected.
    qaGroup20 = 20;

let teacher = 10;

let header = new Header,
    rightNav = new RightNav,
    workspace = new Workspace,
    teacherDashboard = new TeacherDashboard;

const baseUrl = `${Cypress.config("baseUrl")}`;

context('Teacher workspace',function(){ //does not have My Work tab and has Teacher in user name
    describe('Check header area for correctness', function(){
        it("setup", function(){ //need to setup two groups to verify teacher can switch groups
            cy.setupGroup(studentArr10, qaGroup10); //This publishes canvases to Class Work
        });
        it('will go to a teacher view of the setup class', function() {
            cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=teacher:'+teacher+'&problem='+problem);
            // cy.wait(3000)
        });
        it('will verify if class name is correct', function(){
            header.getClassName().should('contain',''+'Class '+qaClass);
        });
        it('will verify teacher name is correct', function(){
            header.getUserName().should('contain','Teacher '+teacher);
        });
        it('will verify the groups tab is present', function(){
            teacherDashboard.getGroupList().should('be.visible');
        });
        it('will verify if group names are present', function(){
            teacherDashboard.getGroupNameNew().should('contain',qaGroup10);
        });
        xit('will verify teacher can switch groups', function(){
            workspace.leaveGroup();
            teacherDashboard.getGroupName().should('contain',qaGroup10);
            teacherDashboard.getGroupName().should('contain',qaGroup20);
            teacherDashboard.getGroupName().contains(qaGroup20).click();
            teacherDashboard.joinGroup();
            header.getGroupName().should('contain','Group '+qaGroup20);
        });
    });
    // TODO: Class Work has changed with new feature changes.
    describe.skip('Check right nav for correctness', function(){
        it('will verify that Class Work tab comes up and My Work tab is not visible', function(){
            rightNav.getClassWorkTab().should('be.visible');
            rightNav.getClassLogTab().should('be.visible');
            rightNav.getMyWorkTab().should('not.be.visible');
        });
    });
});
