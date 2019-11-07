import Header from '../../../../support/elements/common/Header';
import ClueHeader from '../../../../support/elements/clue/cHeader';


const header = new Header;
const clueHeader = new ClueHeader;

let student = '5',
    classroom = '5',
    group = '5',
    offering = '5',
    problemSet = '2.1';

    before(function(){
        const baseUrl = `${Cypress.config("baseUrl")}`;
        const queryParams = `${Cypress.config("queryParams")}`;
    
        // cy.clearQAData('all');
        cy.visit(baseUrl+queryParams);
        cy.wait(4000);
    });
describe('Check header area for correctness', function(){
    it('will verify if class name is correct', function(){
        header.getClassName().should('contain',''+'Class '+classroom);
    });
    it('will verify if group name is present', function(){
        clueHeader.getGroupName().should('contain','Group '+ group);
    });
    it('will verify group members is correct', function(){
        clueHeader.getGroupMembers().should('contain','S'+student);
    });
    it('will verify student name is correct', function(){
        header.getUserName().should('contain','Student '+student);
    });
});
// TODO: Need to be written
describe.skip('Students, class, group, problem combinations', function(){
    it('will test new student assigned to new class new group new problem', function(){

    });
    it('will test previous student assigned to a new class, new group, new problem', function(){

    });
    it('will test previous student assigned to previous class, previous group, new problem', function(){

    });
    it('will test previous student assigned to previous class, previous group, previous problem', function(){

    });
    it('will test previous student assigned to previous class, new group, new problem', function(){

    });
    it('will test previous student assigned to previous class, new group, old problem', function(){

    });
    it('will test previously logged in student assigned to new class, new group, previous problem', function(){

    });
})

after(function(){
  cy.clearQAData('all');
});