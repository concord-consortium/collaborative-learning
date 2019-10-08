import ClueHeader from '../../../support/elements/clue/cHeader'
import Dialog from "../../../support/elements/common/Dialog";

const dialog = new Dialog
const header = new ClueHeader;

context('Test header elements',()=>{
    describe('Test header UI',()=>{
        it('verify ui existence',()=>{
            header.getGroupName().should('exist');
            header.getGroupMembers().should('exist');    
        })
    })
    describe('Test switching groups', function(){
        before(()=>{
            header.getGroupName().invoke('text').as('group')
        })
        it('verify user can cancel switching groups', function(){
            header.cancelLeaveGroup();
            header.getGroupName().should('contain', this.group)
        })
        it('verify user can switch groups',function(){
            let newGroup = 4;
            header.leaveGroup();
            cy.get('.app > .join > .join-title').should('contain','Join Group');
            //select a group 20 from the dropdown
            cy.get('select').select('Group ' + newGroup);
            cy.get('[value="Create Group"]').click();
            cy.wait(1000);
        })
    })
    describe('Test switching investigation',()=>{

    })
})