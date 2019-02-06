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
describe('Add teacher supports to specific sections', function(){
    it('will add a message to whole class for specific section and verify message appears in teacher dashboard', function(){
        let section1 = "Extra Workspace";
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=teacher:'+teacher+'&problem='+problem);
        cy.wait(1000);
        teacherDashboard.selectSection('class', section1);
        teacherDashboard.sendSupportMessage('class','This message is for whole class in '+section1);
        teacherDashboard.getClassSupportsMessage().should('be.visible').and('contain','whole class in '+section1);


        let section2="Initial Challenge";
        teacherDashboard.selectGroup(qaGroup10);
        teacherDashboard.selectSection('group',section2);
        teacherDashboard.sendSupportMessage('group','This message is for group'+qaGroup10+' in '+section2);
        teacherDashboard.getGroupSupportsMessage().should('be.visible').and('contain', 'group'+qaGroup10+' in '+section2);


        let section3='What if...?';
        teacherDashboard.selectGroup(qaGroup10);
        teacherDashboard.selectStudent(studentArr10[0]);
        teacherDashboard.selectSection('user', section3);
        teacherDashboard.sendSupportMessage('user','This message is for S'+studentArr10[0]+' in '+section3);
        teacherDashboard.getStudentSupportsMessage().should('be.visible').and('contain', 'S'+studentArr10[0] +' in '+section3);
    });

    it('verify message appears for class in specific section', function(){
        let i=0, j=0;
        let section1 = "Extra Workspace";

        for (i=0; i<studentArr10.length; i++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup10+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace(section1);
            cy.wait(3000);
            cy.get('[data-test="support-icon class"]').last().click();
            cy.get('[data-test="supports-list"]').contains('whole class in '+section1)
        }
        //verify message does not appear in non-specified section
        leftNav.openToWorkspace('Introduction');
        cy.wait(1000);
        cy.get('[data-test="support-icon class"]').should('not.exist');

        for (j=0; j<studentArr20.length; j++){
            cy.visit(baseUrl+'?appMode=qa&qaGroup='+qaGroup20+'&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[j]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace(section1);
            cy.wait(3000);
            cy.get('[data-test="support-icon class"]').last().click();
            cy.get('[data-test="supports-list"]').contains('whole class in '+section1)
        }
        //verify message does not appear in non-specified section
        leftNav.openToWorkspace('Introduction');
        cy.wait(1000);
        cy.get('[data-test="support-icon class"]').should('not.exist'); 
    });

    it('verify message appears in the section for a group', function(){
        let i=0;
        let section2="Initial Challenge";
        for (i=0;i<studentArr10.length;i++){
            cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[i]+'&problem='+problem);
            cy.wait(2000);
            leftNav.openToWorkspace(section2);
            cy.wait(3000);
            cy.get('[data-test="support-icon group"]').last().click();
            cy.get('[data-test="supports-list"]').contains('group'+qaGroup10+' in '+section2) 
        }
         //verify message does not appear in non-specified section
        leftNav.openToWorkspace('Introduction');
        cy.wait(1000);
        cy.get('[data-test="support-icon group"]').should('not.exist'); 

        //verify message does not appear in non-specified group
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[1]+'&problem='+problem)
        cy.wait(2000);
        leftNav.openToWorkspace(section2);
        cy.wait(3000);
        cy.get('[data-test="support-icon group"]').should('not.exist'); 
    });

    it('will add a message to a student for a specific section and verify message appears in the section for a student', function(){
        let i=0;
        let section3='What if...?';
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr10[0]+'&problem='+problem);
        cy.wait(2000);
        leftNav.openToWorkspace(section3);
        cy.wait(3000);
        cy.get('[data-test="support-icon user"]').last().click();
        cy.get('[data-test="supports-list"]').contains('S'+studentArr10[0]+' in '+section3) ;
  
         //verify message does not appear in non-specified section
         leftNav.openToWorkspace('Introduction');
         cy.wait(1000);
         cy.get('[data-test="support-icon user"]').should('not.exist');

        //verify message does not appear in non-specified user
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+qaClass+'&fakeUser=student:'+studentArr20[1]+'&problem='+problem);
        cy.wait(2000);
        leftNav.openToWorkspace(section3);
        cy.wait(3000);
        cy.get('[data-test="support-icon user"]').should('not.exist');
    });
});