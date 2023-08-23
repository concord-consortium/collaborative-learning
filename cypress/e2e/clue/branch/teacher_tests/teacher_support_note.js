import TeacherDashboard from "../../../../support/elements/clue/TeacherDashboard";
import ClueCanvas from "../../../../support/elements/clue/cCanvas";

let dashboard = new TeacherDashboard();

const queryParams = {
  teacherQueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=teacher:6",
  student10QueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:10&qaGroup=3",
  student7QueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:7&qaGroup=2",
  student1QueryParams: "/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:1&qaGroup=1",
  student2QueryParams: '/?appMode=demo&demoName=CLUE-Test&fakeClass=5&fakeOffering=5&problem=2.1&fakeUser=student:2&qaGroup=1',
}

const textToGroup = "This is a note to Group 3";
const textToStudent = "This is a note to clue testing1";
let groupIndex = 0,
        studentName = "Student 1",
        quadrant = "north-west";

function beforeTest(params) {
  cy.clearQAData('all');
  cy.visit(params);
  cy.waitForLoad();
  dashboard.switchView("Dashboard");
  cy.wait(8000);
}

function loadStudentSession(params) {
  cy.visit(params);
  cy.waitForLoad();
  cy.wait(5000);
}

context('Support messages in student view', () => {
  it('verify group support note appears in student view', function () {
    beforeTest(queryParams.teacherQueryParams);

    cy.log('send group note')
    dashboard.sendGroupNote(2, textToGroup);

    cy.log('verify group support note appears in student view');
    loadStudentSession(queryParams.student10QueryParams);
    cy.get('#icon-sticky-note').should('exist').click({force:true});
    cy.get('#icon-sticky-note').click({force:true}).then(()=> {
      cy.get('.sticky-note-popup').should('exist');
      cy.get('.sticky-note-popup-item-content').should('contain', textToGroup);
    });
    
    cy.log('verify group support note not in student view in different group');
    loadStudentSession(queryParams..student7QueryParams);
    cy.get('#icon-sticky-note').should('not.exist');
  });

  it('verify individual support note appears in student view', function () {
    beforeTest(queryParams.teacherQueryParams);

    cy.log('send group note')
    dashboard.sendStudentNote(groupIndex, studentName, quadrant, textToStudent);

    cy.log('verify student support note appears in student view');
    loadStudentSession(queryParams.student1QueryParams);
    cy.get('#icon-sticky-note').should('exist').click({force:true});
    cy.get('#icon-sticky-note').click({force:true}).then(()=> {
      cy.get('.sticky-note-popup').should('exist');
      cy.get('.sticky-note-popup-item-content').should('contain', textToStudent);
    });

    cy.log("verify student support note is not in another student's view");
    loadStudentSession(queryParams.student2QueryParams);
    cy.get('#icon-sticky-note').should('not.exist');
  });
});
