import Header from '../../../support/elements/common/Header';
import ClueHeader from '../../../support/elements/common/cHeader';

const header = new Header;
const clueHeader = new ClueHeader;

let student1 = '20',
  student2 = '21',
  student3 = '22',
  student4 = '23',
  student5 = '24',
  student6 = '25',
  // Students with ids higher than 99 are not part of the fake class
  // that is setup for QA, Dev, and Demo modes. For the CLUE window
  // that is showing a high id student they are added to the class,
  // but for other CLUE windows they will not be part of the class.
  // So when viewed in other CLUE windows this student will
  // be considered not in the class.
  studentNotInClass = '150',
  fakeClass = '15',
  problem = '1.1',
  group1 = '20',
  group2 = '21';

const defaultSetupOptions = {
  alreadyInGroup: false,
  problem
};

function setup(student, opts = {}) {
  const options = { ...defaultSetupOptions, ...opts };
  cy.visit('/?appMode=qa&fakeClass=' + fakeClass + '&fakeUser=student:' + student + '&problem=' + options.problem + '&unit=./demo/units/qa/content.json');
  if (options.alreadyInGroup) {
    // This is looking for the version div in the header
    cy.waitForLoad();
  } else {
    // If the student is not in a group already the header will not show up
    // instead only a group chooser dialog is shown. The timeout of 60s is the same
    // used by waitForLoad and gives the app extra time to load
    cy.get('.join-title', { timeout: 60000 });
  }
}

context('Test student join a group', function () {
  it('Test student join a group', function () {
    cy.log('Student 1 will join and will verify Join Group Dialog comes up with welcome message to correct student');
    setup(student1);
    cy.get('.app > .join > .join-title').should('contain', 'Join Group');
    cy.get('.app > .join > .join-content > .welcome').should('contain', 'Student ' + student1);

    cy.log('will create a group');
    //select a group 20 from the dropdown
    cy.get('select').select('Group ' + group1);
    cy.get('[value="Create Group"]').click();
    // cy.wait(1000);

    cy.log('will verify student is an specified group');
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student1);
    clueHeader.getGroupMembers().should('contain', 'S' + student1);

    cy.log('will verify created group is no longer available as a choice in Join Group dialog dropdown');
    setup(student2);
    cy.get('.app > .join > .join-title').should('contain', 'Join Group');
    cy.get('.app > .join > .join-content > .welcome').should('contain', 'Student ' + student2);
    cy.get('select > option').should('not.contain', 'Group ' + group1);

    cy.log('will have another student joining an existing group');
    //Student2 will join the same group
    cy.get('.groups > .group-list > .group').contains(group1).click();

    cy.log('will verify second student is in existing group');
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student2);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2);

    cy.log('will verify that both students are listed in the group in the Join Group group list');
    setup(student3);
    cy.get('.groups > .group-list > .group').first().should('contain', 'Group ' + group1).and('contain', 'S' + student1).and('contain', 'S' + student2);
    cy.get('select').select('Group ' + group2);
    cy.get('[value="Create Group"]').click();
    clueHeader.getGroupName().should('contain', 'Group ' + group2);
    header.getUserName().should('contain', 'Student ' + student3);
    clueHeader.getGroupMembers().should('contain', 'S' + student3);
    clueHeader.getGroupMembers().should('not.contain', 'S' + student2).and('not.contain', 'S' + student1);

    cy.log('will verify no additional students can join group');
    setup(student4);
    cy.get('.groups > .group-list > .group').contains(group1).click();
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student4);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2).and('contain', 'S' + student4);
    setup(student5);
    cy.get('.groups > .group-list > .group').contains(group1).click();
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student5);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2).and('contain', 'S' + student4).and('contain', 'S' + student5);
    setup(student6);
    cy.get('.groups > .group-list > .group').contains(group1).click();
    cy.get('.join > .join-content > .error').should('be.visible').and('contain', 'Sorry, that group is full');

    cy.log('will verify cancel of leave group dialog');
    //have student leave first group and join second group
    setup(student5, { alreadyInGroup: true });
    cy.get('.app .group > .name').contains('Group ' + group1).click();
    cy.get('#cancelButton').should('contain', 'No').click();
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student5);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2).and('contain', 'S' + student4).and('contain', 'S' + student5);

    cy.log('will verify a student can switch groups');
    //have student leave first group and join second group
    setup(student5, { alreadyInGroup: true });
    cy.get('.app .group > .name').contains('Group ' + group1).click();
    cy.get("#okButton").should('contain', 'Yes').click();
    cy.get('.groups > .group-list > .group').contains('Group ' + group2).click();
    clueHeader.getGroupName().should('contain', 'Group ' + group2);
    header.getUserName().should('contain', 'Student ' + student5);
    clueHeader.getGroupMembers().should('contain', 'S' + student3).and('contain', 'S' + student5);

    cy.log('will verify new student can join group when one leaves it');
    //have new student join the first group
    setup(student6);
    cy.wait(500);
    cy.get('.groups > .group-list > .group').contains(group1).click();
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student6);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2).and('contain', 'S' + student4).and('contain', 'S' + student6);

    cy.log('Student will automatically join last group number in new problem');
    setup(student1, { alreadyInGroup: true, problem: '2.2' });
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student1);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('have.length', 1);

    cy.log('will verify a student removed from the class is not visible');
    // have student6 leave first group so special student can join
    setup(student6, { alreadyInGroup: true });
    cy.get('.app .group > .name').contains('Group ' + group1).click();
    cy.get("#okButton").should('contain', 'Yes').click();

    // have special student join group 1
    setup(studentNotInClass);
    cy.wait(500);
    cy.get('.groups > .group-list > .group').contains(group1).click();
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + studentNotInClass);
    clueHeader.getGroupMembers()
      .should('contain', 'S' + student1)
      .and('contain', 'S' + student2)
      .and('contain', 'S' + student4)
      .and('contain', 'S' + studentNotInClass);

    // Need to wait more than 1s so the student not in the class is considered removed
    cy.wait(1500);
    // switch back to student 1
    setup(student1, { alreadyInGroup: true });
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student1);
    // The studentNotInClass should not show up now
    clueHeader.getGroupMembers()
      .should('contain', 'S' + student1)
      .and('contain', 'S' + student2)
      .and('contain', 'S' + student4)
      .and('not.contain', '**') // these are the initials of new students
      .and('not.contain', 'S' + studentNotInClass);

    cy.log('verify a 4th student can join a group with a removed student');
    setup(student6);
    cy.get('.groups > .group-list > .group').contains(group1).click();
    clueHeader.getGroupName().should('contain', 'Group ' + group1);
    header.getUserName().should('contain', 'Student ' + student6);
    clueHeader.getGroupMembers()
      .should('contain', 'S' + student1)
      .and('contain', 'S' + student2)
      .and('contain', 'S' + student4)
      .and('contain', 'S' + student6);
  });
});
