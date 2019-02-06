import Header from '../support/elements/Header';
import RightNav from '../support/elements/RightNav';
import LeftNav from '../support/elements/LeftNav';
import Canvas from '../support/elements/Canvas';
import Workspace from '../support/elements/Workspace';
import TeacherDashboard from '../support/elements/TeacherDashboard';

let qaClass = 10,
    qaGroup10 = 10,
    problem = 2.3,
    studentArr10=[15,16],
    studentArr20=[25,26],
    qaGroup20 = 20;

let teacher = 10;

let header = new Header,
    rightNav = new RightNav,
    leftNav = new LeftNav,
    canvas = new Canvas,
    workspace = new Workspace,
    teacherDashboard = new TeacherDashboard;

const baseUrl = `${Cypress.config("baseUrl")}`;
   
describe('setup', function(){
    it("will set up groups", function(){ //need to setup two groups to verify teacher can switch groups
        cy.setupGroup(studentArr10, qaGroup10); //This publishes canvases to Class Work
        cy.setupGroup(studentArr20, qaGroup20); //This publishes canvases to Class Work
    });
});    

describe('Teacher can add support messages to all sections', function(){

    it('will add a message for all sections to whole class, a group, and a student, and verify message appears in teacher dashboard', function() {
        cy.visit(baseUrl + '?appMode=qa&fakeClass=' + qaClass + '&fakeUser=teacher:' + teacher + '&problem=' + problem);
        cy.wait(1000);
        // Add message to class
        teacherDashboard.sendSupportMessage('class', 'This message is for whole class in all sections');
        teacherDashboard.getClassSupportsMessage().should('be.visible').and('contain','whole class in all sections');
        // Add message to group
        teacherDashboard.selectGroup(qaGroup10);
        teacherDashboard.sendSupportMessage('group', 'This message is for group 10 in all sections');
        teacherDashboard.getGroupSupportsMessage().should('be.visible').and('contain','group 10 in all sections');

        // add message to student
        teacherDashboard.selectStudent(studentArr10[0]);
        teacherDashboard.sendSupportMessage('user', 'This message is for S' + studentArr10[0] + ' in all sections');
        cy.wait(1000);
        teacherDashboard.getStudentSupportsMessage().should('be.visible').and('contain', 'S'+studentArr10[0] +' in all sections'); 
    });

    it('verify message appears in all sections for whole class', function(){
        let i = 0, j = 0;

        for (i=0; i<studentArr10.length; i++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace('Introduction');
            cy.wait(3000);
            cy.get('[data-test="support-icon class"]').last().click();
            cy.get('[data-test="supports-list"]').contains('whole class in all sections');
            leftNav.openToWorkspace('Extra Workspace');
            cy.wait(1000);
            cy.get('[data-test="supports-list"]').contains('whole class in all sections');
        }

        for (j=0; j<studentArr20.length; j++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[j]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace('Initial Challenge');
            cy.wait(3000);
            cy.get('[data-test="support-icon class"]').last().click();
            cy.get('[data-test="supports-list"]').contains('whole class in all sections');
            leftNav.openToWorkspace('Now What');
            // cy.wait(1000);
            cy.get('[data-test="supports-list"]').contains('whole class in all sections');
        }
    });

    it('verify message appears in all sections for a group and not the other', function(){
        let i=0;

        for (i=0; i<studentArr10.length; i++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
            cy.wait(3000);
            leftNav.openToWorkspace('What if...?');
            cy.wait(3000);
            cy.get('[data-test="support-icon group"]').last().click();
            cy.get('[data-test="supports-list"]').contains('group 10 in all sections')
            leftNav.openToWorkspace('Introduction');
            // cy.wait(1000);
            cy.get('[data-test="supports-list"]').contains('group 10 in all sections')
        }

        // verify message is not in the other group
        cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[0]+'&problem='+problem);
        cy.wait(2000);
        leftNav.openToWorkspace('Initial Challenge');
        cy.wait(3000);
        cy.get('[data-test="support-icon group"]').should('not.exist');
    });

    it('verify message appears in all sections for a student and not another', function(){
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[0]+'&problem='+problem);
        cy.wait(2000);
        leftNav.openToWorkspace('What if...?');
        cy.wait(3000);
        cy.get('[data-test="support-icon user"]').last().click();
        cy.get('[data-test="supports-list"]').contains('S'+studentArr10[0]+' in all sections')
        leftNav.openToWorkspace('Now What');
        cy.wait(1000);
        cy.get('[data-test="supports-list"]').contains('S'+studentArr10[0]+' in all sections')

        // verify that message does not appear  for another student in all sections
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[1]+'&problem='+problem);
        cy.wait(2000);
        leftNav.openToWorkspace('Initial Challenge');
        cy.wait(3000);
        cy.get('[data-test="support-icon user"]').should('not.exist');
    });
});

describe('it will delete messages', function(){
    it('will delete a message to whole class for all sections and verify message disappears in all sections for whole class', function() {
        cy.visit(baseUrl + '?appMode=qa&fakeClass=' + qaClass + '&fakeUser=teacher:' + teacher + '&problem=' + problem);
        cy.wait(1000);
        teacherDashboard.deleteClassSupportMessage();
        teacherDashboard.getClassSupportsMessage().should('not.exist')

        teacherDashboard.selectGroup(qaGroup10);
        teacherDashboard.deleteGroupSupportMessage();
        teacherDashboard.getGroupSupportsMessage().should('not.exist');

        // teacherDashboard.selectGroup(qaGroup10);
        teacherDashboard.selectStudent(studentArr10[0]);
        teacherDashboard.deleteStudentSupportMessage();
        teacherDashboard.getStudentSupportsMessage().should('not.exist');
    });

    it('will verify message is not in all sections for whole class', function(){
        let i = 0, j = 0;
        for (i=0; i<studentArr10.length; i++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace('Initial Challenge');
            cy.wait(3000);
            cy.get('[data-test="support-icon class"]').should('not.exist');
            leftNav.openToWorkspace('Extra Workspace');
            cy.wait(1000);
            cy.get('[data-test="support-icon class"]').should('not.exist');
        }
        for (j=0; j<studentArr20.length; j++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[j]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace('Now What');
            cy.wait(3000);
            cy.get('[data-test="support-icon class"]').should('not.exist');
            leftNav.openToWorkspace('Introduction');
            cy.wait(1000);
            cy.get('[data-test="support-icon class"]').should('not.exist');
        }
    });

    it('verify message disappears in all sections for a group', function(){
        let i=0;
        for (i=0; i<studentArr10.length; i++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace('Introduction');
            cy.wait(3000);
            cy.get('[data-test="support-icon group"]').should('not.exist');
            leftNav.openToWorkspace('Initial Challenge');
            cy.wait(1000);
            cy.get('[data-test="support-icon group"]').should('not.exist');
        }
    });

    it('verify message disappears in all sections for a student', function(){
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[0]+'&problem='+problem);
        cy.wait(2000);
        leftNav.openToWorkspace('What if...?');
        cy.wait(3000);
        cy.get('[data-test="support-icon user"]').should('not.exist');
        leftNav.openToWorkspace('Extra Workspace');
        cy.wait(1000);
        cy.get('[data-test="support-icon user"]').should('not.exist');
    });
});