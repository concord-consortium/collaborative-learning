import Header from '../../../../support/elements/common/Header';
import ClueHeader from '../../../../support/elements/clue/cHeader';


const header = new Header;
const clueHeader = new ClueHeader;

let student = '5',
    classroom = '5',
    group = '5';

describe('Check header area for correctness', function(){
    before(function(){
        const queryParams = `${Cypress.config("queryParams")}`;

        cy.clearQAData('all');
        cy.visit(queryParams);
        cy.waitForLoad();
    });

    it('will verify if class name is correct', function(){
        header.getClassName().should('contain', 'Class '+classroom);
    });
    it('will verify if group name is present', function(){
        clueHeader.getGroupName().should('contain', 'Group '+ group);
    });
    it('will verify group members is correct', function(){
        clueHeader.getGroupMembers().should('contain', 'S'+student);
    });
    it('will verify student name is correct', function(){
        header.getUserName().should('contain', 'Student '+student);
    });
    it('will verify student network status', function(){
        header.getNetworkStatus().should('contain', 'Online');
    });
    it('will verify teacher options are not displayed', function(){
        header.getDashboardWorkspaceToggleButtons().should("not.exist");
        cy.get('.top-tab.tab-teacher-guide').should("not.exist");
        cy.get('.top-tab.tab-student-work').should("not.exist");
        cy.get('[data-test="solutions-button"]').should("not.exist");
        // cy.get('.chat-panel-toggle').should("not.exist"); // this is nolonger true and chat-panel-toggle is being made available to students
    });

});

