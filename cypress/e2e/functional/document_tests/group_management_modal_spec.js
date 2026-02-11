import Header from '../../../support/elements/common/Header';
import ClueHeader from '../../../support/elements/common/cHeader';

/**
 * Group Management Modal Tests
 *
 * NOTE ON TEST STRUCTURE:
 * The student and teacher tests are each consolidated into single large test blocks
 * rather than separate it() blocks. This is intentional because QA mode data does not
 * reliably persist between separate Cypress tests. By keeping related tests in one block,
 * we can build up state naturally without needing to duplicate setup in each test.
 *
 * NOTE ON realClick() FOR CLICKS:
 * Many click operations use realClick() because the group management modal uses dnd-kit
 * for drag-and-drop functionality. dnd-kit's pointer event handling interferes with
 * Cypress's simulated clicks, causing them to not register properly.
 */

const header = new Header();
const clueHeader = new ClueHeader();

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
  teacher1 = '1',
  fakeClass = '15',
  problem = '1.1';

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
    // instead the group management modal is shown. The timeout of 60s is the same
    // used by waitForLoad and gives the app extra time to load
    cy.get('[data-testid="group-management-modal-title"]', { timeout: 60000 });
  }
}

function setupTeacher(teacher, opts = {}) {
  const options = { ...defaultSetupOptions, ...opts };
  cy.visit('/?appMode=qa&fakeClass=' + fakeClass + '&fakeUser=teacher:' + teacher + '&problem=' + options.problem + '&unit=./demo/units/qa/content.json');
  cy.waitForLoad();
}

function openTeacherGroupModal() {
  cy.get('.student-groups-button').click();
  cy.get('[data-testid="group-management-modal-title"]').should('contain', 'Move Students to Different Groups');
}

function selectGroupAndSave(groupId) {
  // Click on group card header to avoid accidentally clicking on student cards inside the group.
  cy.get(`[data-testid="group-card-${groupId}"] .group-card__header`)
    .should('be.visible')
    .realClick();
  cy.get('[data-testid="group-management-modal-save-button"]').should('not.be.disabled').click();
  cy.get('[data-testid="group-management-modal"]').should('not.exist');
}

function openGroupModalFromHeader() {
  cy.get('.app .group').click();
  cy.get('[data-testid="group-management-modal-title"]');
}

function teacherMoveStudentToGroup(studentId, groupId) {
  // Only click to select if not already selected (clicking again would toggle/deselect).
  cy.get(`[data-testid="student-card-${studentId}"]`).should('be.visible').then($card => {
    if (!$card.hasClass('selected')) {
      cy.wrap($card).realClick();
    }
  });
  cy.get(`[data-testid="student-card-${studentId}"]`).should('have.class', 'selected');
  // Click on group card header to avoid accidentally clicking on student cards inside the group
  cy.get(`[data-testid="group-card-${groupId}"] .group-card__header`).realClick();
  cy.get(`[data-testid="group-card-${groupId}"]`).should('contain', 'Student ' + studentId);
}

function saveAndCloseModal() {
  cy.get('[data-testid="group-management-modal-save-button"]').click();
  cy.get('[data-testid="group-management-modal"]').should('not.exist');
}

context('Test student join a group', function () {
  it('Test student join a group', function () {
    cy.log('Student 1 will join and will verify Join Group modal comes up');
    setup(student1);
    cy.get('[data-testid="group-management-modal-title"]').should('contain', 'Join Group');

    cy.log('will create a group by selecting the first available group');
    // The new modal shows sequential groups (1, 2, 3...) rather than arbitrary numbers
    // First student with no existing groups sees "Group 1"
    selectGroupAndSave("1");

    cy.log('will verify student is in the specified group');
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student1);
    clueHeader.getGroupMembers().should('contain', 'S' + student1);

    cy.log('will verify student 2 sees existing group and can join it');
    setup(student2);
    cy.get('[data-testid="group-management-modal-title"]').should('contain', 'Join Group');
    // Should see Group 1 as an existing group
    cy.get('[data-testid="group-card-1"]').should('exist');

    cy.log('will have another student joining an existing group');
    selectGroupAndSave("1");

    cy.log('will verify second student is in existing group');
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student2);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2);

    cy.log('will verify that both students are listed in the group in the modal');
    setup(student3);
    // Check that Group 1 shows the existing students
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student1).and('contain', 'Student ' + student2);
    // Student 3 creates a new group (Group 2)
    selectGroupAndSave("2");
    clueHeader.getGroupName().should('contain', 'Group 2');
    header.getUserName().should('contain', 'Student ' + student3);
    clueHeader.getGroupMembers().should('contain', 'S' + student3);
    clueHeader.getGroupMembers().should('not.contain', 'S' + student2).and('not.contain', 'S' + student1);

    cy.log('will verify additional students can join group');
    setup(student4);
    selectGroupAndSave("1");
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student4);
    clueHeader.getGroupMembers().should('contain', 'S' + student1)
                                .and('contain', 'S' + student2)
                                .and('contain', 'S' + student4);
    setup(student5);
    selectGroupAndSave("1");
    clueHeader.getGroupMembers().should('contain', 'S' + student1)
                                .and('contain', 'S' + student2)
                                .and('contain', 'S' + student4)
                                .and('contain', 'S' + student5);

    cy.log('will verify cancel of group switch');
    // Student already in a group clicks their group in the header to open the modal
    setup(student5, { alreadyInGroup: true });
    openGroupModalFromHeader();
    cy.get('[data-testid="group-management-modal-title"]').should('contain', 'Join a Different Group');
    // Click Cancel to stay in current group
    cy.get('[data-testid="group-management-modal-cancel-button"]').click();
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student5);
    clueHeader.getGroupMembers().should('contain', 'S' + student1)
                                .and('contain', 'S' + student2)
                                .and('contain', 'S' + student4)
                                .and('contain', 'S' + student5);

    cy.log('will verify ESC key closes modal without changes');
    setup(student5, { alreadyInGroup: true });
    openGroupModalFromHeader();
    cy.get('[data-testid="group-management-modal-title"]').should('contain', 'Join a Different Group');
    cy.get('[data-testid="group-management-modal"]').type('{esc}');
    cy.get('[data-testid="group-management-modal"]').should('not.exist');
    // Verify student is still in the same group
    clueHeader.getGroupName().should('contain', 'Group 1');

    cy.log('will verify clicking current group does not enable Save button');
    setup(student5, { alreadyInGroup: true });
    openGroupModalFromHeader();
    // Student 5 is in Group 1, clicking Group 1 should not enable Save
    // Click on group card header to avoid accidentally clicking on student cards inside the group.
    cy.get(`[data-testid="group-card-1"] .group-card__header`)
      .should('be.visible')
      .realClick();
    // Save button should still be disabled since no change was made
    cy.get('[data-testid="group-management-modal-save-button"]').should('be.disabled');
    // Close modal
    cy.get('[data-testid="group-management-modal-cancel-button"]').click();

    cy.log('will verify student cannot select other students');
    setup(student5, { alreadyInGroup: true });
    openGroupModalFromHeader();
    // Student 5 is in Group 1 with students 1, 2, 4. Try clicking on student 1's card.
    // In student mode, clicking another student should do nothing (no selection, Save stays disabled)
    cy.get(`[data-testid="student-card-${student1}"]`).should('exist').realClick();
    // Save button should still be disabled - students can only move themselves
    cy.get('[data-testid="group-management-modal-save-button"]').should('be.disabled');
    // The clicked student should not have a selected style
    cy.get(`[data-testid="student-card-${student1}"]`).should('not.have.class', 'selected');
    // Close modal
    cy.get('[data-testid="group-management-modal-cancel-button"]').click();

    cy.log('will verify "Last name, First name" display toggle');
    setup(student5, { alreadyInGroup: true });
    openGroupModalFromHeader();
    // Initially names should be displayed as "First Last"
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student1);
    // Check the "Last name, First name" checkbox
    cy.get('[data-testid="group-management-modal-sort-checkbox"]').check();
    // Now names should be displayed as "Last, First" format
    // Student names in test are like "Student 20", so it should become "20, Student"
    cy.get('[data-testid="group-card-1"]').should('contain', student1 + ', Student');
    // Uncheck to restore default
    cy.get('[data-testid="group-management-modal-sort-checkbox"]').uncheck();
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student1);
    // Close modal
    cy.get('[data-testid="group-management-modal-cancel-button"]').click();

    cy.log('will verify a student can switch groups');
    // Student 5 switches from Group 1 to Group 2
    setup(student5, { alreadyInGroup: true });
    openGroupModalFromHeader();
    cy.get('[data-testid="group-management-modal-title"]').should('contain', 'Join a Different Group');
    selectGroupAndSave("2");
    clueHeader.getGroupName().should('contain', 'Group 2');
    header.getUserName().should('contain', 'Student ' + student5);
    clueHeader.getGroupMembers().should('contain', 'S' + student3).and('contain', 'S' + student5);

    cy.log('will verify new student can join group when one leaves it');
    // Student 6 joins Group 1 (which student 5 left)
    setup(student6);
    selectGroupAndSave("1");
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student6);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('contain', 'S' + student2).and('contain', 'S' + student4).and('contain', 'S' + student6);

    cy.log('Student will automatically join last group number in new problem');
    setup(student1, { alreadyInGroup: true, problem: '2.2' });
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student1);
    clueHeader.getGroupMembers().should('contain', 'S' + student1).and('have.length', 1);

    cy.log('will verify a student removed from the class is not visible');
    // have student6 leave first group so special student can join
    setup(student6, { alreadyInGroup: true });
    openGroupModalFromHeader();
    // Switch student6 to group 2 to make room
    selectGroupAndSave("2");

    // have special student join group 1
    setup(studentNotInClass);
    selectGroupAndSave("1");
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + studentNotInClass);
    clueHeader.getGroupMembers().should('contain', 'S' + student1)
                                .and('contain', 'S' + student2)
                                .and('contain', 'S' + student4)
                                .and('contain', 'S' + studentNotInClass);

    // Need to wait more than 1s so the student not in the class is considered removed
    cy.wait(1500);
    // switch back to student 1
    setup(student1, { alreadyInGroup: true });
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student1);
    // The studentNotInClass should not show up now
    clueHeader.getGroupMembers().should('contain', 'S' + student1)
                                .and('contain', 'S' + student2)
                                .and('contain', 'S' + student4)
                                .and('not.contain', '**') // these are the initials of new students
                                .and('not.contain', 'S' + studentNotInClass);

    cy.log('verify a 4th student can join a group with a removed student');
    setup(student6, { alreadyInGroup: true });
    openGroupModalFromHeader();
    selectGroupAndSave("1");
    clueHeader.getGroupName().should('contain', 'Group 1');
    header.getUserName().should('contain', 'Student ' + student6);
    clueHeader.getGroupMembers().should('contain', 'S' + student1)
                                .and('contain', 'S' + student2)
                                .and('contain', 'S' + student4)
                                .and('contain', 'S' + student6);
  });
});

context('Test teacher group management', function () {
  it('Teacher can manage student groups', function () {
    setupTeacher(teacher1);
    openTeacherGroupModal();

    cy.log('Move students from No Group to create groups');
    cy.get('[data-testid="group-card-no-group"]').should('contain', 'Student ' + student1);
    cy.get('[data-testid="group-card-no-group"]').should('contain', 'Student ' + student2);
    cy.get('[data-testid="group-card-no-group"]').should('contain', 'Student ' + student3);

    teacherMoveStudentToGroup(student1, "1");
    cy.get('[data-testid="group-card-no-group"]').should('not.contain', 'Student ' + student1);
    teacherMoveStudentToGroup(student2, "1");
    teacherMoveStudentToGroup(student3, "2");
    teacherMoveStudentToGroup(student4, "1");

    cy.get('[data-testid="group-management-modal-save-button"]').should('not.be.disabled');
    saveAndCloseModal();

    openTeacherGroupModal();
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student1);
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student2);
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student4);
    cy.get('[data-testid="group-card-2"]').should('contain', 'Student ' + student3);

    cy.log('Move students between existing groups');
    teacherMoveStudentToGroup(student1, "2");
    cy.get('[data-testid="group-card-1"]').should('exist');
    cy.get('[data-testid="group-card-1"]').should('not.contain', 'Student ' + student1);

    saveAndCloseModal();

    openTeacherGroupModal();
    cy.get('[data-testid="group-card-2"]').should('contain', 'Student ' + student1);
    cy.get('[data-testid="group-card-1"]').should('exist');

    cy.log('Cancel changes without saving');
    teacherMoveStudentToGroup(student2, "2");
    cy.get('[data-testid="group-card-1"]').should('not.contain', 'Student ' + student2);

    cy.get('[data-testid="group-management-modal-cancel-button"]').click();
    cy.get('[data-testid="group-management-modal"]').should('not.exist');

    openTeacherGroupModal();
    cy.get('[data-testid="group-card-1"]').should('contain', 'Student ' + student2);
    cy.get('[data-testid="group-card-2"]').should('not.contain', 'Student ' + student2);

    cy.log('Move student to No Group');
    teacherMoveStudentToGroup(student4, "no-group");
    cy.get('[data-testid="group-card-1"]').should('not.contain', 'Student ' + student4);

    saveAndCloseModal();

    openTeacherGroupModal();
    cy.get('[data-testid="group-card-no-group"]').should('contain', 'Student ' + student4);

    cy.log('Create multiple sequential new groups with empty intermediates');

    teacherMoveStudentToGroup(student5, "3");
    cy.get('[data-testid="group-card-3"]').should('contain', 'Student ' + student5);
    // Move the same student to create Group 4 (Group 3 should remain visible but empty)
    teacherMoveStudentToGroup(student5, "4");
    cy.get('[data-testid="group-card-3"]').should('exist').and('not.contain', 'Student ' + student5);
    cy.get('[data-testid="group-card-4"]').should('contain', 'Student ' + student5);

    saveAndCloseModal();

    // Verify both groups persist after save - Group 3 empty, Group 4 with student
    openTeacherGroupModal();
    cy.get('[data-testid="group-card-3"]').should('exist').and('not.contain', 'Student ' + student5);
    cy.get('[data-testid="group-card-4"]').should('exist').and('contain', 'Student ' + student5);
    cy.get('[data-testid="group-management-modal-cancel-button"]').click();

    cy.log('Test keyboard nav - Tab to student and select with Enter key');
    openTeacherGroupModal();
    cy.get('[data-testid="group-management-modal-close-button"]').focus();
    cy.realPress('Tab'); // to first group card
    cy.realPress('Tab'); // to first student in that group
    cy.focused().invoke('attr', 'data-testid').should('match', /^student-card-/);
    cy.focused().invoke('attr', 'data-testid').then(testId => {
      cy.realPress('Enter');
      cy.get(`[data-testid="${testId}"]`).should('have.class', 'selected');
    });

    cy.log('Test keyboard nav - Tab from selected student to next group card and select with Enter key');
    // When a student is selected, other students are removed from tab order,
    // so tabbing should go directly to the next group card.
    cy.get(`[data-testid="student-card-${student2}"]`).should('have.attr', 'tabindex', '0');
    cy.get(`[data-testid="student-card-${student1}"]`).should('have.attr', 'tabindex', '-1');
    cy.get(`[data-testid="student-card-${student3}"]`).should('have.attr', 'tabindex', '-1');
    cy.realPress('Tab');
    cy.focused().invoke('attr', 'data-testid').should('match', /^group-card-/);
    cy.focused().invoke('attr', 'data-testid').then(testId => {
      cy.realPress('Enter');
      if (testId !== 'group-card-1') {
        cy.get(`[data-testid="${testId}"]`).should('contain', 'Student ' + student2);
        cy.get('[data-testid="group-card-1"]').should('not.contain', 'Student ' + student2);
      }
    });
    cy.get('[data-testid="group-management-modal-cancel-button"]').click();
  });
});
