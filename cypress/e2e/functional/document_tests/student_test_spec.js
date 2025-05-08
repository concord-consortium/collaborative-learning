import Header from '../../../support/elements/common/Header';
import ClueHeader from '../../../support/elements/common/cHeader';
import SortedWork from "../../../support/elements/common/SortedWork";
import Canvas from '../../../support/elements/common/Canvas';
import ClueCanvas from '../../../support/elements/common/cCanvas';
import { visitQaSubtabsUnit } from "../../../support/visit_params";


const header = new Header;
const clueHeader = new ClueHeader;
const sortWork = new SortedWork;
const canvas = new Canvas;
const clueCanvas = new ClueCanvas;

const copyTitle = "Personal Workspace";

let student = '5',
  classroom = '5',
  group = '5';

function beforeTest(queryParams) {
  cy.visit(queryParams);
  cy.waitForLoad();
}

function openAllGroupSections() {
  cy.get('.section-header-label').should("contain", "Group 1");
  cy.get('.section-header-label').should("contain", "Group 2");
  cy.get('.section-header-label').should("contain", "Group 3");
  cy.get('.section-header-label').should("contain", "No Group");
  cy.get(".section-header-arrow").click({multiple: true});
}

context('Check header area for correctness', function () {
  it('verify header area', function () {
    beforeTest(`${Cypress.config("qaUnitStudent5")}`);

    cy.log('will verify if class name is correct');
    header.getClassName().should('contain', 'Class ' + classroom);

    cy.log('will verify if group name is present');
    clueHeader.getGroupName().should('contain', 'Group ' + group);

    cy.log('will verify group members is correct');
    clueHeader.getGroupMembers().should('contain', 'S' + student);

    cy.log('will verify student name is correct');
    header.getUserName().should('contain', 'Student ' + student);

    cy.log('will verify student network status');
    header.getNetworkStatus().should('contain', 'Online');

    cy.log('will verify teacher options are not displayed');
    header.getDashboardWorkspaceToggleButtons().should("not.exist");
    cy.get('.top-tab.tab-teacher-guide').should("not.exist");
    cy.get('.top-tab.tab-student-work').should("not.exist");
    cy.get('[data-test="solutions-button"]').should("not.exist");
  });
});

context("check public/private document access", function() {
  it("marks private documents as private and only shows public documents as accessible", function() {
    [1,2,3].forEach(studentId => {
      // Put each student in their own group
      visitQaSubtabsUnit({student: studentId, group: studentId});
      if (studentId === 2) {
        // Share the student 2 problem document
        cy.wait(500); // CLUE needs time to create the metadata doc
        clueCanvas.shareCanvas();
      }
      canvas.copyDocument(copyTitle);
      canvas.getPersonalDocTitle().find('span').text().should('contain', copyTitle);
      if (studentId === 2) {
        // Share the student 2 personal document
        cy.wait(500); // CLUE needs time to create the metadata doc
        clueCanvas.shareCanvas();

        // Share the student 3 learning log
        canvas.openDocumentWithTitleWithoutTabs("Learning Log");
        cy.wait(500); // CLUE needs time to create the metadata doc
        clueCanvas.shareCanvas();

        // Give CLUE time to update the shared property in the metadata
        cy.wait(500);
      }
    });

    // Go back to student 1
    visitQaSubtabsUnit({student: 1, group: 1});

    cy.openTopTab("sort-work");

    cy.log("verify user's own documents are not marked as private and are accessible");
    openAllGroupSections();
    sortWork.checkGroupDocumentVisibility("Group 1", false, true);

    cy.log("verify other user's shared documents are not marked as private and are accessible");
    sortWork.checkGroupDocumentVisibility("Group 2", false, true);

    cy.log("verify private documents are marked as private and are not accessible");
    sortWork.checkGroupDocumentVisibility("Group 3", true, true);

    // Check the same conditions in a view that contains compact document items
    sortWork.getShowForMenu().click();
    sortWork.getShowForInvestigationOption().click();

    cy.log("verify user's own documents are not marked as private and are accessible in the compact view");
    // In this case the sections are still open from before
    // openAllGroupSections();
    sortWork.checkGroupDocumentVisibility("Group 1", false);

    cy.log("verify other user's shared documents are not marked as private and are accessible in the compact view");
    sortWork.checkGroupDocumentVisibility("Group 2", false);

    cy.log("verify private documents are marked as private and are not accessible in the compact view");
    sortWork.checkGroupDocumentVisibility("Group 3", true);
  });
});
