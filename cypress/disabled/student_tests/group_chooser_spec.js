import Header from '../../../../support/elements/common/Header'
import ClueHeader from '../../../../support/elements/clue/cHeader'


const header = new Header;
const clueHeader = new ClueHeader;
const baseUrl = `${Cypress.config("baseUrl")}`;

describe('Test student join a group', function(){
    let student1 = '20',
        student2 = '21',
        student3 = '22',
        student4 = '23',
        student5='24',
        student6='25',
        fakeClass = '15',
        problem = '2.2',
        group1='20',
        group2='21';


    function setup(student){
        cy.visit(baseUrl+'?appMode=qa&fakeClass='+fakeClass+'&fakeUser=student:'+student+'&problem='+problem);
        cy.waitForSpinner();
    }

    it('Student 1 will join and will verify Join Group Dialog comes up with welcome message to correct student', function(){
        setup(student1);
        cy.get('.app > .join > .join-title').should('contain','Join Group');
        cy.get('.app > .join > .join-content > .welcome').should('contain','Student ' + student1);
    });

    it('will create a group', function(){
        //select a group 20 from the dropdown
        cy.get('select').select('Group ' + group1);
        cy.get('[value="Create Group"]').click();
        // cy.wait(1000);
    });
    it('will verify student is an specified group', function(){
        clueHeader.getGroupName().should('contain','Group '+group1);
        header.getUserName().should('contain','Student '+student1);
        clueHeader.getGroupMembers().should('contain','S'+student1);

    });
    it('will verify created group is no longer available as a choice in Join Group dialog dropdown', function(){
        setup(student2);
        cy.get('.app > .join > .join-title').should('contain','Join Group');
        cy.get('.app > .join > .join-content > .welcome').should('contain','Student ' +  student2);
        cy.get('select > option').should('not.contain','Group '+group1);
    });
    it('will have another student joining an existing group', function(){
            //Student2 will join the same group
        cy.get('.groups > .group-list > .group').contains(group1).click();
    });
    it('will verify second student is in existing group', function(){
        clueHeader.getGroupName().should('contain','Group '+group1);
        header.getUserName().should('contain','Student '+student2);
        clueHeader.getGroupMembers().should('contain','S'+student1).and('contain','S'+student2);
    });

    it('will will verify that both students are listed in the group in the Join Group group list and will create a new group when a student selects a different group and verify workspace header is correct', function(){
        setup(student3);
        cy.get('.groups > .group-list > .group').first().should('contain','Group '+group1).and('contain','S'+student1).and('contain','S'+student2);
        cy.get('select').select('Group ' + group2);
        cy.get('[value="Create Group"]').click();
        clueHeader.getGroupName().should('contain','Group '+group2);
        header.getUserName().should('contain','Student '+student3);
        clueHeader.getGroupMembers().should('contain','S'+student3);
        clueHeader.getGroupMembers().should('not.contain','S'+student2).and('not.contain','S'+student1);
    });
    it('will verify no additional students can join group',function(){
        setup(student4);
        cy.get('.groups > .group-list > .group').contains(group1).click();
        clueHeader.getGroupName().should('contain','Group '+group1);
        header.getUserName().should('contain','Student '+student4);
        clueHeader.getGroupMembers().should('contain','S'+student1).and('contain','S'+student2).and('contain','S'+student4);
        setup(student5);
        cy.get('.groups > .group-list > .group').contains(group1).click();
        clueHeader.getGroupName().should('contain','Group '+group1);
        header.getUserName().should('contain','Student '+student5);
        clueHeader.getGroupMembers().should('contain','S'+student1).and('contain','S'+student2).and('contain','S'+student4).and('contain','S'+student5);
        setup(student6);
        cy.get('.groups > .group-list > .group').contains(group1).click();
        cy.get('.join > .join-content > .error').should('be.visible').and('contain','Sorry, that group is full');
    });
    it('will verify cancel of leave group dialog',function(){
        //have student leave first group and join second group
        setup(student5);
        cy.get('.app .group > .name').contains('Group '+group1).click();
        cy.get('#cancelButton').should('contain','No').click();
        clueHeader.getGroupName().should('contain','Group '+group1);
        header.getUserName().should('contain','Student '+student5);
        clueHeader.getGroupMembers().should('contain','S'+student1).and('contain','S'+student2).and('contain','S'+student4).and('contain','S'+student5);

    });
    it('will verify a student can switch groups',function(){
        //have student leave first group and join second group
        setup(student5);
        cy.get('.app .group > .name').contains('Group '+group1).click();
        cy.get("#okButton").should('contain','Yes').click();
        cy.get('.groups > .group-list > .group').contains('Group '+group2).click();
        clueHeader.getGroupName().should('contain','Group '+group2);
        header.getUserName().should('contain','Student '+student5);
        clueHeader.getGroupMembers().should('contain','S'+student3).and('contain','S'+student5);
    });
    it('will verify new student can join group when one leaves it', function(){
        //have new student join the first group
        setup(student6);
        cy.get('.groups > .group-list > .group').contains(group1).click();
        clueHeader.getGroupName().should('contain','Group '+group1);
        header.getUserName().should('contain','Student '+student6);
        clueHeader.getGroupMembers().should('contain','S'+student1).and('contain','S'+student2).and('contain','S'+student4).and('contain','S'+student6);
    });
});

after(function(){
    cy.clearQAData('all');
  });
